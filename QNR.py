# =============================================================================
#  使用说明
# =============================================================================
# 1. 功能简介
#    - 本程序用于计算融合影像的QNR（Quality with No Reference）无参考质量评价指数，
#      以及其分量 D_lambda（光谱失真）和 DS（空间失真）。
#
# 2. 输入要求
#    - 需提供三幅影像文件：融合后影像（Fused.tif）、多光谱原图（MS.tif）、SAR图像（SAR.tif）。
#    - 三幅影像需空间对齐，尺寸（height, width）完全一致，波段顺序匹配。
#    - 支持单波段和多波段影像，SAR单波段会自动扩展为与融合影像同波段数。
#
# 3. 路径设置
#    - 默认影像文件名为 Fused.tif、MS.tif、SAR.tif。
#    - 如需更换文件名或路径，请在 main 部分修改 fused_path、ms_path、sar_path 变量。
#    - 路径建议使用英文及数字，避免中文或特殊字符。
#
# 4. 依赖环境
#    - 需安装 rasterio、numpy、scikit-image（skimage）。
#    - 可用 pip install rasterio numpy scikit-image 安装。
#
# 5. 注意事项
#    - 影像需为 tif 格式，且能够被 rasterio 正确读取。
#    - 若影像 shape 不一致，或空间未配准，会导致结果异常。
#    - QNR 为 [0,1] 区间，越接近1表示融合质量越好。DS、D_lambda 越接近0越好。
#
# 6. 输出
#    - 在终端输出 QNR、D_lambda（光谱失真）、DS（空间失真）三个指标。
#
# 7. 结果异常排查
#    - 若QNR为负数或DS、D_lambda远大于1，说明输入影像未对齐或内容异常，请检查数据预处理。
# =============================================================================

import numpy as np
import rasterio
from skimage.metrics import normalized_root_mse

def read_image(path):
    with rasterio.open(path) as src:
        img = src.read().astype(np.float32)
    return img

def spectral_distortion(fused, ms):
    # 假定输入为 (bands, height, width)
    bands = fused.shape[0]
    d_lambda = 0
    for b in range(bands):
        # 归一化均方误差
        nmse = normalized_root_mse(fused[b], ms[b]) ** 2
        d_lambda += nmse
    d_lambda /= bands
    return d_lambda

def spatial_distortion(fused, sar):
    # 取SAR主分量与融合影像的高频部分做比较（简单实现为与融合影像各波段平均），可改进
    bands = fused.shape[0]
    ds = 0
    sar_mean = np.mean(sar, axis=0)
    for b in range(bands):
        nmse = normalized_root_mse(fused[b], sar_mean) ** 2
        ds += nmse
    ds /= bands
    return ds

def QNR(fused, ms, sar):
    D_lambda = spectral_distortion(fused, ms)
    DS = spatial_distortion(fused, sar)
    qnr = (1 - D_lambda) * (1 - DS)
    return qnr, D_lambda, DS

if __name__ == "__main__":
    # 影像路径
    fused_path = "Fused.tif"
    ms_path = "MS.tif"
    sar_path = "SAR.tif"

    # 读取影像
    fused = read_image(fused_path) # shape: (bands, height, width)
    ms = read_image(ms_path)
    sar = read_image(sar_path) # shape: (bands, height, width) or (1, h, w)

    # 若SAR为单波段，扩展到多波段
    if sar.shape[0] == 1:
        sar = np.repeat(sar, fused.shape[0], axis=0)

    qnr, d_lambda, ds = QNR(fused, ms, sar)
    print(f"QNR: {qnr:.4f}")
    print(f"D_lambda (Spectral distortion): {d_lambda:.4f}")
    print(f"DS (Spatial distortion): {ds:.4f}")
