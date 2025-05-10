import numpy as np
import rasterio
from skimage.metrics import normalized_root_mse

def read_image(path):
    with rasterio.open(r'D:\01 Work\Graduation Project\image\1m\fused_image.tif') as src:
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