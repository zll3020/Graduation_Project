import rasterio
import pywt
import numpy as np
import matplotlib.pyplot as plt


# 读取数据
with rasterio.open(r'D:\01 Work\Graduation Project\image\1m\PC1.tif') as src:
    pc1 = src.read(1)
    profile = src.profile  # 保存空间信息用于输出

with rasterio.open(r'D:\01 Work\Graduation Project\image\1m\SAR_VV.tif') as src:
    sar = src.read(1)

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
with rasterio.open('fused_PC1.tif', 'w', **profile) as dst:
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
plt.show()
