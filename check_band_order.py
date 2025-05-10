import rasterio

def check_band_order(tif_path):
    with rasterio.open(r"D:\Envi\ENVI56\data\沉湖数据\沉湖S2\S2_allbands_NDWI_norm_2024_1.tif") as src:
        print(f"File: {tif_path}")
        print("Band count:", src.count)
        print("Image shape (height, width):", src.height, src.width)
        print("CRS:", src.crs)
        print("----------")
        for i in range(1, src.count + 1):
            band = src.read(i)
            print(f"Band {i}: min={band.min():.2f}, max={band.max():.2f}, mean={band.mean():.2f}, std={band.std():.2f}")
        print("----------")
        if src.descriptions and any(src.descriptions):
            print("Band Descriptions:")
            for idx, desc in enumerate(src.descriptions, 1):
                print(f"  Band {idx}: {desc}")
        else:
            print("No band descriptions found in the file header.")
        print("----------")

if __name__ == "__main__":
    tif_path = "multi_fusion.tif"  # 修改为你的影像文件路径
    check_band_order(tif_path)