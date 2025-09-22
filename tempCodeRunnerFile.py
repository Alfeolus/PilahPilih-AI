from flask import Flask, render_template, Response, jsonify, request
from ultralytics import YOLO
import cv2
import numpy as np
import base64
import os

# Inisialisasi aplikasi Flask
app = Flask(__name__)

# Muat model YOLOv8 Anda menggunakan path relatif (praktik terbaik)
model = YOLO("hasil_training/sampah_cls/weights/best.pt")

# Dapatkan nama kelas langsung dari atribut model, ini cara yang benar
class_names = model.names

@app.route('/')
def index():
    # Mengirim daftar nama kelas ke halaman HTML
    return render_template('index.html', class_names=list(class_names.values()))

@app.route('/video_feed', methods=['POST'])
def video_feed():
    data = request.json['image']
    img_data = base64.b64decode(data.split(',')[1])
    np_arr = np.frombuffer(img_data, np.uint8)
    img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

    if img is None:
        return jsonify({'error': 'Failed to decode image'}), 400

    results = model(img, verbose=False)
    
    if results and results[0].probs is not None:
        probs = results[0].probs
        # Menggunakan atribut yang lebih modern dari ultralytics
        top_prob_idx = probs.top1
        predicted_class_name = class_names[top_prob_idx]
        confidence = probs.top1conf.item() # .item() untuk mendapatkan nilai float murni

        # Membuat dictionary untuk semua probabilitas kelas
        all_probs_dict = {class_names[i]: prob.item() for i, prob in enumerate(results[0].probs.data)}

        return jsonify({
            'prediction': predicted_class_name,
            'confidence': f"{confidence:.2f}",
            'all_probs': all_probs_dict
        })
    else:
        return jsonify({'prediction': 'No detection', 'confidence': 'N/A'}), 200

@app.route('/upload_image', methods=['POST'])
def upload_image():
    if 'image' not in request.files:
        return jsonify({'error': 'No image part in the request'}), 400
    
    file = request.files['image']
    if file.filename == '':
        return jsonify({'error': 'No selected image'}), 400
    
    if file:
        np_arr = np.frombuffer(file.read(), np.uint8)
        img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

        if img is None:
            return jsonify({'error': 'Failed to decode uploaded image'}), 400

        results = model(img, verbose=False)

        if results and results[0].probs is not None:
            probs = results[0].probs
            top_prob_idx = probs.top1
            predicted_class_name = class_names[top_prob_idx]
            confidence = probs.top1conf.item()

            all_probs_dict = {class_names[i]: prob.item() for i, prob in enumerate(results[0].probs.data)}

            return jsonify({
                'prediction': predicted_class_name,
                'confidence': f"{confidence:.2f}",
                'all_probs': all_probs_dict
            })
        else:
            return jsonify({'prediction': 'No detection', 'confidence': 'N/A'}), 200
            
    return jsonify({'error': 'Something went wrong'}), 500

# Blok untuk menjalankan server, kompatibel dengan Azure
if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    app.run(debug=False, host='0.0.0.0', port=port)