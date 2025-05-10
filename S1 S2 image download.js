// 区域定义（请在GEE代码编辑器中定义 geometry 变量）
var studyarea = geometry;
Map.addLayer(studyarea, {}, '研究区');

// Sentinel-2 云掩膜函数（适用于 Level-2A）
function maskS2clouds(image) {
  var cloudProbability = image.select('MSK_CLDPRB');
  var sceneClassification = image.select('SCL');
  var mask = cloudProbability.lt(20)
    .and(sceneClassification.neq(3))
    .and(sceneClassification.neq(8))
    .and(sceneClassification.neq(9))
    .and(sceneClassification.neq(10));
  return image.updateMask(mask);
}

// 计算NDWI
function addWaterIndex(image) {
  var ndwi = image.normalizedDifference(['B3', 'B8']).rename('NDWI');
  return image.addBands(ndwi);
}

// 归一化函数
function normalize(image, band) {
  var minMax = image.reduceRegion({
    reducer: ee.Reducer.minMax(),
    geometry: studyarea,
    scale: 10,
    maxPixels: 1e13
  });
  var min = ee.Number(minMax.get(band + '_min'));
  var max = ee.Number(minMax.get(band + '_max'));
  var norm = image.select(band).subtract(min).divide(max.subtract(min)).rename(band + '_norm');
  return image.addBands(norm);
}

// 配对每月S2和S1，并导出
var months = ee.List.sequence(1, 12);
var year = 2024;

// 建议在GEE中每次运行一个月，避免导出任务过多
months.getInfo().forEach(function(month) {
  month = parseInt(month);
  var startDate = ee.Date.fromYMD(year, month, 1);
  var endDate = startDate.advance(1, 'month');

  // 查找该月所有S2，按云量升序
  var s2Candidates = ee.ImageCollection('COPERNICUS/S2_SR')
    .filterBounds(studyarea)
    .filterDate(startDate, endDate)
    .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20))
    .map(maskS2clouds)
    .map(addWaterIndex)
    .sort('CLOUDY_PIXEL_PERCENTAGE');

  // 取云量最低的S2影像
  var s2Best = ee.Image(s2Candidates.first());
  var s2Date = ee.Date(s2Best.get('system:time_start'));

  // 查找与S2采集日期间隔不超过14天的S1，按时间距离排序
  var s1Candidates = ee.ImageCollection('COPERNICUS/S1_GRD')
    .filterBounds(studyarea)
    .filterDate(s2Date.advance(-14, 'day'), s2Date.advance(14, 'day'))
    .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VV'))
    .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VH'))
    .filter(ee.Filter.eq('instrumentMode', 'IW'))
    .map(function(img) {
      // 计算与S2的日期差（绝对值，单位：天）
      var diff = ee.Number(ee.Date(img.get('system:time_start')).difference(s2Date, 'day')).abs();
      return img.set('diffDays', diff);
    })
    .sort('diffDays');

  var s1Best = ee.Image(s1Candidates.first());

  // 对S2 NDWI归一化
  var s2BestNorm = normalize(s2Best, 'NDWI');

  // 导出S2 所有水色相关波段（B1~B8A）及归一化NDWI，并统一为float32
Export.image.toDrive({
  image: s2BestNorm.select([
    'B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8', 'B8A', 'NDWI_norm'
  ]).toFloat(),
  description: 'S2_allbands_NDWI_norm_' + year + '_' + month,
  region: studyarea,
  scale: 10,
  maxPixels: 1e13,
  fileFormat: 'GeoTIFF'
});

  // 导出配对的S1（VV/VH）
  Export.image.toDrive({
    image: s1Best.select(['VV', 'VH']),
    description: 'S1_' + year + '_' + month,
    region: studyarea,
    scale: 10,
    maxPixels: 1e13,
    fileFormat: 'GeoTIFF'
  });
});
