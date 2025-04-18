// 定义沉湖国际重要湿地的几何区域
var studyarea = geometry;
Map.addLayer(studyarea, {}, '沉湖国际重要湿地');

// 云掩膜函数（适用于哨兵二号 Level-2A 数据）
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

// 处理哨兵二号影像
for (var month = 1; month <= 12; month++) {
  var year = 2024; // 修改为变量，便于调整年份
  var startDate = ee.Date.fromYMD(year, month, 1);
  var endDate = startDate.advance(1, 'month');

  var s2Dataset = ee.ImageCollection('COPERNICUS/S2_SR')
    .filterBounds(studyarea)
    .filterDate(startDate, endDate)
    .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20)) // 筛选云覆盖率低于20%的影像
    .map(maskS2clouds) // 应用云掩膜
    .map(function(image) {
      // 计算 NDVI 并添加为新波段（重命名为 NDVI）
      var ndvi = image.normalizedDifference(['B8', 'B4']).rename('NDVI');
      return image.addBands(ndvi);
    })
    .map(function(image) {
      // 重命名并选择关键波段，避免波段冲突
      return image.select(['B2', 'B3', 'B4', 'B8', 'NDVI'], 
                          ['B1', 'B2', 'B3', 'B4', 'B5']).toFloat(); // 统一数据类型
    });

  // 检查数据集是否为空，避免导出空数据
  if (s2Dataset.size().gt(0)) {
    var s2Image = s2Dataset.median().clip(studyarea).toFloat(); // 计算中值、裁剪并统一数据类型

    Export.image.toDrive({
      image: s2Image,
      description: 'S2_2024_' + month + '_' + Date.now(), // 添加时间戳避免文件名冲突
      region: studyarea,
      scale: 10,
      maxPixels: 1e13
    });
  } else {
    print('No Sentinel-2 data available for month: ' + month);
  }
}

// 处理哨兵一号影像
for (var month = 1; month <= 12; month++) {
  var year = 2024; // 修改为变量，便于调整年份
  var startDate = ee.Date.fromYMD(year, month, 1);
  var endDate = startDate.advance(1, 'month');

  var s1Dataset = ee.ImageCollection('COPERNICUS/S1_GRD')
    .filterBounds(studyarea)
    .filterDate(startDate, endDate)
    .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VV')) // 筛选 VV 极化
    .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VH')) // 筛选 VH 极化
    .filter(ee.Filter.eq('instrumentMode', 'IW')); // 筛选干涉宽幅模式

  // 检查数据集是否为空，避免导出空数据
  if (s1Dataset.size().gt(0)) {
    var s1Image = s1Dataset.median().clip(studyarea).toFloat(); // 计算中值、裁剪并统一数据类型

    Export.image.toDrive({
      image: s1Image,
      description: 'S1_2024_' + month + '_' + Date.now(), // 添加时间戳避免文件名冲突
      region: studyarea,
      scale: 10,
      maxPixels: 1e13
    });
  } else {
    print('No Sentinel-1 data available for month: ' + month);
  }
}