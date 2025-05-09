// 定义沉湖国际重要湿地的几何区域
var studyarea = geometry;
Map.addLayer(studyarea, {}, '沉湖国际重要湿地');

// Sentinel-2 云掩膜函数（适用于 Level-2A 数据）
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

// 计算水体指数（NDWI）
// 此时还未重命名波段，用原始S2波段名
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

// 由于 GEE 不支持 for 循环批量导出，这里推荐用列表循环
var months = ee.List.sequence(1, 12);
var year = 2024;

// 注意：批量导出任务建议每次只运行一个月，避免GEE任务队列溢出
months.getInfo().forEach(function(month) {
  month = parseInt(month);
  var startDate = ee.Date.fromYMD(year, month, 1);
  var endDate = startDate.advance(1, 'month');

  // Sentinel-2 数据处理
  var s2Dataset = ee.ImageCollection('COPERNICUS/S2_SR')
    .filterBounds(studyarea)
    .filterDate(startDate, endDate)
    .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20))
    .map(maskS2clouds)
    .map(addWaterIndex)
    .map(function(image) {
      // 先重命名4个主波段
      return image
        .select(['B2', 'B3', 'B4', 'B8', 'NDWI'], ['Blue', 'Green', 'Red', 'NIR', 'NDWI'])
        .divide(10000)
        .toFloat();
    });

  // Sentinel-1 数据处理
  var s1Dataset = ee.ImageCollection('COPERNICUS/S1_GRD')
    .filterBounds(studyarea)
    .filterDate(startDate, endDate)
    .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VV'))
    .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VH'))
    .filter(ee.Filter.eq('instrumentMode', 'IW'))
    .map(function(image) {
      return image.select(['VV', 'VH']).toFloat();
    });

  // 取中值影像
  var s2Image = s2Dataset.median().clip(studyarea);
  var s1Image = s1Dataset.median().clip(studyarea);

  // 归一化NDWI波段
  var s2ImageNorm = normalize(s2Image, 'NDWI');

  // 导出，每月数据建议手动运行，否则会有任务队列上限限制
  Export.image.toDrive({
    image: s2ImageNorm.select('NDWI_norm'),
    description: 'S2_NDWI_norm_' + year + '_' + month,
    region: studyarea,
    scale: 10,
    maxPixels: 1e13,
    fileFormat: 'GeoTIFF'
  });
  Export.image.toDrive({
    image: s1Image.select(['VV', 'VH']),
    description: 'S1_' + year + '_' + month,
    region: studyarea,
    scale: 10,
    maxPixels: 1e13,
    fileFormat: 'GeoTIFF'
  });
});
