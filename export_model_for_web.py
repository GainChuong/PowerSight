import pickle
import json
import xgboost as xgb

PKL_PATH = r"D:\PowerSight\user_behavior_xgb_lasso.pkl"
OUTPUT_JSON_PATH = r"D:\PowerSight\Power_Sight\webapp\extension\model_data.json"

def export_model():
    print("Đang đọc file PKL...")
    try:
        with open(PKL_PATH, "rb") as f:
            data = pickle.load(f)
        
        xgb_model = data.get("xgb_model")
        selected_features = data.get("selected_features")
        
        if xgb_model is None or selected_features is None:
            print("Lỗi: Không tìm thấy xgb_model hoặc selected_features trong file PKL!")
            return
            
        print(f"✅ Đã tìm thấy model XGBoost với các features: {selected_features}")
        
        # XGBoost có hàm lưu nội bộ thành JSON
        # Ta lấy cấu trúc cây dưới dạng danh sách các string (mỗi string là 1 cây JSON)
        booster = xgb_model.get_booster()
        trees_json = booster.get_dump(dump_format='json')
        
        # Lưu vào một file JSON duy nhất để đưa vào Extension
        export_data = {
            "selected_features": selected_features,
            "trees": [json.loads(tree) for tree in trees_json]
        }
        
        with open(OUTPUT_JSON_PATH, "w", encoding='utf-8') as f:
            json.dump(export_data, f)
            
        print(f"🎉 Đã xuất model thành công ra: {OUTPUT_JSON_PATH}")
        print("Bây giờ Chrome Extension đã có thể đọc và chạy model này!")
        
    except Exception as e:
        print(f"❌ Có lỗi xảy ra: {e}")

if __name__ == "__main__":
    export_model()
