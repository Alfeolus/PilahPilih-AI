document.addEventListener('DOMContentLoaded', () => {
    const webcam = document.getElementById('webcam');
    const canvas = document.getElementById('canvas');
    const context = canvas.getContext('2d');
    const predictionOverlay = document.getElementById('prediction-overlay');
    const predictionText = document.getElementById('prediction-text');
    const confidenceText = document.getElementById('confidence-text');
    const probList = document.getElementById('prob-list');

    const modeCameraButton = document.getElementById('mode-camera');
    const modeUploadButton = document.getElementById('mode-upload');
    const cameraView = document.getElementById('camera-view');
    const uploadView = document.getElementById('upload-view');

    const imageUploadInput = document.getElementById('image-upload');
    const selectImageButton = document.getElementById('select-image-btn');
    const uploadedImagePreview = document.getElementById('uploaded-image-preview');
    const detectUploadedButton = document.getElementById('detect-uploaded-btn');
    const uploadPredictionInfo = document.getElementById('upload-prediction-info');
    const uploadedPredictionText = document.getElementById('uploaded-prediction-text');
    const uploadedConfidenceText = document.getElementById('uploaded-confidence-text');


    let cameraStream = null; // Variabel untuk menyimpan stream kamera
    let intervalId = null; // Variabel untuk menyimpan ID interval pengiriman frame

    // --- Fungsi Bantuan ---
    function updatePredictionDisplay(prediction, confidence, allProbs, targetPredictionText, targetConfidenceText) {
        targetPredictionText.textContent = prediction;
        targetConfidenceText.textContent = `${(parseFloat(confidence) * 100).toFixed(2)}%`;

        probList.innerHTML = ''; // Bersihkan daftar probabilitas sebelumnya
        if (allProbs) {
            const sortedProbs = Object.entries(allProbs).sort(([, a], [, b]) => b - a);
            sortedProbs.forEach(([className, prob]) => {
                const listItem = document.createElement('li');
                listItem.innerHTML = `<span>${className}</span> <span>${(prob * 100).toFixed(2)}%</span>`;
                probList.appendChild(listItem);
            });
        }
    }

    function resetPredictionDisplay() {
        predictionText.textContent = "Memuat...";
        confidenceText.textContent = "N/A";
        uploadedPredictionText.textContent = "";
        uploadedConfidenceText.textContent = "";
        probList.innerHTML = '';
        uploadPredictionInfo.style.display = 'none';
        predictionOverlay.style.display = 'none'; // Sembunyikan overlay kamera
    }

    // --- Mode Kamera ---
    function startCamera() {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            navigator.mediaDevices.getUserMedia({ video: true })
                .then(function (stream) {
                    cameraStream = stream;
                    webcam.srcObject = stream;
                    webcam.play();
                    predictionOverlay.style.display = 'block'; // Tampilkan overlay prediksi
                    intervalId = setInterval(sendFrameFromCamera, 1000); // Mulai kirim frame
                })
                .catch(function (err) {
                    console.error("Error accessing webcam: ", err);
                    predictionText.textContent = "Error: Akses kamera ditolak atau tidak tersedia.";
                    predictionOverlay.style.display = 'block'; // Tetap tampilkan pesan error
                });
        } else {
            predictionText.textContent = "Error: Browser Anda tidak mendukung getUserMedia.";
            predictionOverlay.style.display = 'block';
        }
    }

    function stopCamera() {
        if (cameraStream) {
            cameraStream.getTracks().forEach(track => track.stop());
            webcam.srcObject = null;
            cameraStream = null;
        }
        if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
        }
        predictionOverlay.style.display = 'none'; // Sembunyikan overlay prediksi kamera
    }

    function sendFrameFromCamera() {
        if (webcam.readyState === webcam.HAVE_ENOUGH_DATA && cameraStream) {
            context.drawImage(webcam, 0, 0, canvas.width, canvas.height);
            const imageData = canvas.toDataURL('image/jpeg');

            fetch('/video_feed', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image: imageData })
            })
            .then(response => response.json())
            .then(data => {
                if (data.error) {
                    console.error('Backend error (camera):', data.error);
                    predictionText.textContent = "Error Backend.";
                } else {
                    updatePredictionDisplay(data.prediction, data.confidence, data.all_probs, predictionText, confidenceText);
                }
            })
            .catch(error => {   
                console.error('Error sending frame to backend:', error);
                predictionText.textContent = "Error saat prediksi.";
                confidenceText.textContent = "N/A";
            });
        }
    }

    // --- Mode Upload Gambar ---
    selectImageButton.addEventListener('click', () => {
        imageUploadInput.click(); // Memicu klik pada input file tersembunyi
    });

    imageUploadInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                uploadedImagePreview.src = e.target.result;
                uploadedImagePreview.style.display = 'block'; // Tampilkan pratinjau
                detectUploadedButton.style.display = 'block'; // Tampilkan tombol deteksi
                uploadedPredictionText.textContent = ""; // Reset info prediksi
                uploadedConfidenceText.textContent = "";
                uploadPredictionInfo.style.display = 'none'; // Sembunyikan info prediksi
            };
            reader.readAsDataURL(file);
        } else {
            uploadedImagePreview.style.display = 'none';
            detectUploadedButton.style.display = 'none';
            uploadedPredictionText.textContent = "";
            uploadedConfidenceText.textContent = "";
            uploadPredictionInfo.style.display = 'none';
        }
    });

    detectUploadedButton.addEventListener('click', () => {
        const file = imageUploadInput.files[0];
        if (!file) {
            alert('Silakan pilih gambar terlebih dahulu!');
            return;
        }

        const formData = new FormData();
        formData.append('image', file);

        uploadedPredictionText.textContent = "Mendeteksi...";
        uploadedConfidenceText.textContent = "Memuat...";
        uploadPredictionInfo.style.display = 'block';

        fetch('/upload_image', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                console.error('Backend error (upload):', data.error);
                uploadedPredictionText.textContent = "Error Backend.";
            } else {
                updatePredictionDisplay(data.prediction, data.confidence, data.all_probs, uploadedPredictionText, uploadedConfidenceText);
            }
        })
        .catch(error => {
            console.error('Error uploading image to backend:', error);
            uploadedPredictionText.textContent = "Error saat deteksi.";
            uploadedConfidenceText.textContent = "N/A";
        });
    });

    // --- Logic Pergantian Mode (Kamera vs Upload) ---
    modeCameraButton.addEventListener('click', () => {
        if (!modeCameraButton.classList.contains('active')) {
            modeCameraButton.classList.add('active');
            modeUploadButton.classList.remove('active');
            cameraView.classList.add('active-mode');
            cameraView.classList.remove('inactive-mode');
            uploadView.classList.add('inactive-mode');
            uploadView.classList.remove('active-mode');
            
            resetPredictionDisplay(); // Reset tampilan prediksi saat beralih mode
            startCamera(); // Nyalakan kamera
        }
    });

    modeUploadButton.addEventListener('click', () => {
        if (!modeUploadButton.classList.contains('active')) {
            modeUploadButton.classList.add('active');
            modeCameraButton.classList.remove('active');
            uploadView.classList.add('active-mode');
            uploadView.classList.remove('inactive-mode');
            cameraView.classList.add('inactive-mode');
            cameraView.classList.remove('active-mode');

            stopCamera(); // Matikan kamera
            resetPredictionDisplay(); // Reset tampilan prediksi
        }
    });

    // --- Inisialisasi Saat Halaman Dimuat ---
    // Pastikan classNames tersedia dari Flask template
    if (typeof classNames === 'undefined' || !Array.isArray(classNames) || classNames.length === 0) {
        console.error("classNames not loaded correctly from Flask template. Using default.");
        // Fallback jika classNames gagal dimuat, tapi ini harusnya tidak terjadi jika Flask berjalan benar
        // Atau Anda bisa menampilkan pesan error di UI
    } else {
        console.log("Class names loaded:", classNames);
    }
    
    // Mulai dengan mode kamera aktif secara default
    startCamera(); // Memicu event klik untuk inisialisasi
});