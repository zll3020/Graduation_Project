// 定义沉湖国际重要湿地的几何区域
var studyarea = geometry;
Map.addLayer(studyarea, {}, '沉湖国际重要湿地');

// Sentinel-2 云掩膜函数
function maskS2clouds(image) {
  var cloudProbability = image.select('MSK_CLDPRB'); // 云概率波段
  var sceneClassification = image.select('SCL'); // 场景分类波段
  
  // 云掩膜：仅保留云概率低于20%且不属于云、云阴影等
  var mask = cloudProbability.lt(20)
    .and(sceneClassification.neq(3)) // 不为云阴影
    .and(sceneClassification.neq(8)) // 不为云
    .and(sceneClassification.neq(9)) // 不为薄云
    .and(sceneClassification.neq(10)); // 不为卷云

  return image.updateMask(mask).divide(10000).toFloat(); // 应用掩膜、缩放并统一数据类型
}

// Sentinel-1 数据标准化处理
function normalizeS1(image) {
  return image.divide(10000).toFloat(); // 简单归一化
}

// 遍历 2024 年的每个月
for (var month = 1; month <= 12; month++) {
  var year = 2024;
  var startDate = ee.Date.fromYMD(year, month, 1);
  var midDate = startDate.advance(15, 'day'); // 月中日期
  var endDate = startDate.advance(1, 'month');

  // Sentinel-2 数据处理
  var s2Dataset = ee.ImageCollection('COPERNICUS/S2_SR')
    .filterBounds(studyarea)
    .filterDate(startDate, midDate) // 截取前半个月的数据
    .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20)) // 筛选云覆盖率低于20%的影像
    .map(maskS2clouds)
    .map(function(image) {
      // 计算 NDVI 并添加为新波段
      var ndvi = image.normalizedDifference(['B8', 'B4']).rename('NDVI');
      return image.addBands(ndvi)
                  .select(['B2', 'B3', 'B4', 'B8', 'NDVI'], 
                          ['B1', 'B2', 'B3', 'B4', 'B5']).toFloat(); // 统一波段和数据类型
    });

  if (s2Dataset.size().gt(0)) {
    var s2Image = s2Dataset.median().clip(studyarea).toFloat(); // 计算中值并裁剪
    Export.image.toDrive({
      image: s2Image,
      description: 'Sentinel2_2024_' + month,
      region: studyarea,
      scale: 10,
      maxPixels: 1e13
    });
  } else {
    print('No Sentinel-2 data available for month: ' + month);
  }

  // Sentinel-1 数据处理
  var s1Dataset = ee.ImageCollection('COPERNICUS/S1_GRD')
    .filterBounds(studyarea)
    .filterDate(midDate, endDate) // 截取后半个月的数据
    .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VV')) // 筛选 VV 极化
    .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VH')) // 筛选 VH 极化
    .filter(ee.Filter.eq('instrumentMode', 'IW')) // 干涉宽幅模式
    .map(normalizeS1);

  if (s1Dataset.size().gt(0)) {
    var s1Image = s1Dataset.median().clip(studyarea).toFloat(); // 计算中值并裁剪
    Export.image.toDrive({
      image: s1Image,
      description: 'Sentinel1_2024_' + month,
      region: studyarea,
      scale: 10,
      maxPixels: 1e13
    });
  } else {
    print('No Sentinel-1 data available for month: ' + month);
  }
}