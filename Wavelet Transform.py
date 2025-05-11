# =============================================================================
# 程序使用注意事项
# =============================================================================
# 1. 输入影像要求
#    - 多光谱主成分影像（如PC1.tif）和SAR影像（如SAR_VV.tif）必须均为单波段灰度图像。
#    - 建议两者空间分辨率、投影、覆盖范围一致，程序已内置以多光谱影像为基准对SAR自动重采样与裁剪。
#
# 2. 路径设置
#    - 路径请使用英文或数字，避免文件夹或文件名包含中文或特殊字符。
#    - 输入输出路径均需确保文件夹已存在，否则保存可能失败。
#
# 3. 读写权限
#    - 请确认对输入、输出目录均有读写权限，否则会报“Permission denied”错误。
#
# 4. 输出文件
#    - 融合后的影像和可视化图片会分别单独保存，请提前设置好保存地址和文件名。
#
# 5. 依赖环境
#    - 需提前安装 rasterio、numpy、pywt、matplotlib 等依赖库。
#    - 建议使用Anaconda或Mamba等Python环境管理工具，确保包版本兼容。
#
# 6. 其他说明
#    - 如果输入为ENVI格式，直接指定 .dat 文件即可（需保证同名 .hdr 文件在同目录下）。
#    - 若自定义波段或融合方式，请在代码相应位置进行修改。
#    - 若遇形状不一致报错，务必检查输入数据空间参考和尺寸，或联系开发者协助排查。
# =============================================================================

import rasterio
from rasterio.warp import reproject, Resampling
import pywt
import numpy as np
import matplotlib.pyplot as plt


# 读取多光谱主成分影像
with rasterio.open(r'D:\Envi\ENVI56\data\沉湖数据\4m\PC1.tif') as src:
    pc1 = src.read(1)
    profile = src.profile  # 保存空间信息用于输出

# 读取SAR影像，并重采样到多光谱影像的范围和分辨率
with rasterio.open(r"D:\Envi\ENVI56\data\沉湖数据\沉湖S1\S1_2024_4.tif") as src_sar:
    sar = np.empty_like(pc1, dtype=src_sar.dtypes[0])
    reproject(
        source=src_sar.read(1),
        destination=sar,
        src_transform=src_sar.transform,
        src_crs=src_sar.crs,
        dst_transform=profile['transform'],
        dst_crs=profile['crs'],
        resampling=Resampling.bilinear
    )
# 保存重采样后的SAR影像
with rasterio.open(r'D:\Envi\ENVI56\data\沉湖数据\4m\SAR_resampled.tif', 'w', **profile) as dst:
    dst.write(sar.astype(profile['dtype']), 1)

#小波分解
# 选择小波类型和分解级数
wavelet = 'db2'
level = 1

# 对PC1和SAR分别做二维小波分解
coeffs_pc1 = pywt.dwt2(pc1, wavelet)
coeffs_sar = pywt.dwt2(sar, wavelet)

# 分别获得低频（LL）和高频（(LH, HL, HH)）系数
LL_pc1, (LH_pc1, HL_pc1, HH_pc1) = coeffs_pc1
LL_sar, (LH_sar, HL_sar, HH_sar) = coeffs_sar

#系数融合
# 低频部分（LL）：取平均
# 高频部分（LH, HL, HH）：取较大值
LL_fused = (LL_pc1 + LL_sar) / 2
LH_fused = np.maximum(LH_pc1, LH_sar)
HL_fused = np.maximum(HL_pc1, HL_sar)
HH_fused = np.maximum(HH_pc1, HH_sar)

# 重构融合后的图像
# 逆小波变换，得到融合后的PC1主成分
fused_pc1 = pywt.idwt2((LL_fused, (LH_fused, HL_fused, HH_fused)), wavelet)
# 有时逆变换结果尺寸略大于原影像，可裁剪为原始尺寸
fused_pc1 = fused_pc1[:pc1.shape[0], :pc1.shape[1]]

# 保存融合后的影像
with rasterio.open(r'D:\Envi\ENVI56\data\沉湖数据\4m\new_PC1.tif', 'w', **profile) as dst:
    dst.write(fused_pc1.astype(profile['dtype']), 1)

# 可视化
plt.figure(figsize=(12, 4))
plt.subplot(1, 3, 1)
plt.title('Original PC1')
plt.imshow(pc1, cmap='gray')
plt.axis('off')

plt.subplot(1, 3, 2)
plt.title('SAR')
plt.imshow(sar, cmap='gray')
plt.axis('off')

plt.subplot(1, 3, 3)
plt.title('Fused PC1')
plt.imshow(fused_pc1, cmap='gray')
plt.axis('off')

plt.tight_layout()
plt.savefig(r'D:/output/fused_visualization.png', dpi=300)  # 保存可视化图片
plt.show()
