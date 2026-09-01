// Konfigurasi URL Google Apps Script Web App
// GANTI URL DI BAWAH INI DENGAN URL WEB APP GAS ANDA!
const GAS_URL = 'https://script.google.com/macros/s/AKfycbzK-zsXseoVgMrFX3u5Dj7yFXITmFkVR1RtAFFhtKHC1A8sGjk3TlbZazSbR9v89_phyQ/exec';

document.addEventListener('DOMContentLoaded', () => {
    // Inisialisasi Flatpickr untuk kalender dengan format DD/MM/YYYY yang pasti
    flatpickr("#tanggal_lahir", {
        dateFormat: "d/m/Y",
        allowInput: true
    });

    const addFileBtn = document.getElementById('addFileBtn');
    const fileInputsContainer = document.getElementById('fileInputsContainer');
    const form = document.getElementById('uploadForm');
    const loadingOverlay = document.getElementById('loadingOverlay');

    // Menambah form upload file
    addFileBtn.addEventListener('click', () => {
        const wrapper = document.createElement('div');
        wrapper.className = 'file-input-wrapper';

        const input = document.createElement('input');
        input.type = 'file';
        input.name = 'fileUpload[]';
        input.accept = '.pdf, .jpg, .jpeg';
        input.required = true;
        input.className = 'file-input';

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'btn-remove-file';
        removeBtn.title = 'Hapus Berkas';
        removeBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
        removeBtn.onclick = function () {
            wrapper.remove();
            updateRemoveButtons();
        };

        wrapper.appendChild(input);
        wrapper.appendChild(removeBtn);
        fileInputsContainer.appendChild(wrapper);

        updateRemoveButtons();
    });

    function updateRemoveButtons() {
        const wrappers = document.querySelectorAll('.file-input-wrapper');
        const firstRemoveBtn = wrappers[0].querySelector('.btn-remove-file');

        if (wrappers.length > 1) {
            firstRemoveBtn.style.display = 'flex';
        } else {
            firstRemoveBtn.style.display = 'none';
        }
    }

    // Agar fungsi removeFile bisa diakses dari atribut onclick di HTML
    window.removeFile = function (btn) {
        btn.parentElement.remove();
        updateRemoveButtons();
    };

    // Fungsi untuk kompresi gambar agar pengiriman super cepat
    const compressImage = (file) => {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 1000;
                    const MAX_HEIGHT = 1000;
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > MAX_WIDTH) {
                            height *= MAX_WIDTH / width;
                            width = MAX_WIDTH;
                        }
                    } else {
                        if (height > MAX_HEIGHT) {
                            width *= MAX_HEIGHT / height;
                            height = MAX_HEIGHT;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    
                    resolve(canvas.toDataURL('image/jpeg', 0.6).split(',')[1]);
                };
            };
        });
    };

    // Helper untuk mengubah file menjadi Base64
    const getBase64 = async (file) => {
        // Jika file adalah gambar (JPG/JPEG), lakukan kompresi agar cepat terkirim
        if (file.type.startsWith('image/')) {
            return await compressImage(file);
        }
        // Jika file PDF, langsung konversi tanpa kompresi
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result.split(',')[1]); // ambil data setelah koma
            reader.onerror = error => reject(error);
        });
    };

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // 1. Validasi Native
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        // Jika Lanjut, tampilkan loading
        loadingOverlay.classList.add('active');

        try {
            // Siapkan data form
            const formData = new FormData(form);

            // Flatpickr sudah memformat value menjadi DD/MM/YYYY secara otomatis
            const formattedDate = formData.get('tanggal_lahir');

            let waNumber = formData.get('no_whatsapp');
            // Tambahkan tanda kutip satu (') di awal agar Google Sheets tidak menghilangkan angka 0
            if (waNumber) {
                waNumber = "'" + waNumber;
            }

            const dataPayload = {
                nama_pemohon: formData.get('nama_pemohon'),
                nomor_pemohon: formData.get('nomor_pemohon'),
                ttl: formData.get('tempat_lahir') + ', ' + formattedDate,
                no_whatsapp: waNumber,
                petugas: formData.get('petugas'),
                files: []
            };

            // Baca semua file input dan ubah ke Base64
            const fileInputs = document.querySelectorAll('input[type="file"]');
            for (let input of fileInputs) {
                if (input.files.length > 0) {
                    const file = input.files[0];
                    const base64Data = await getBase64(file);
                    dataPayload.files.push({
                        name: file.name,
                        mimeType: file.type,
                        base64: base64Data
                    });
                }
            }

            // Kirim ke Google Apps Script
            // Jika GAS_URL masih default, maka kita simulasikan sukses
            if (GAS_URL === 'URL_WEB_APP_ANDA_DI_SINI') {
                console.warn("GAS URL belum diatur! Mensimulasikan delay sukses...");
                await new Promise(r => setTimeout(r, 2500));
                showSuccess();
                return;
            }

            // fetch request ke GAS
            const response = await fetch(GAS_URL, {
                method: 'POST',
                // Mode text/plain ini menghindari masalah Preflight CORS
                headers: {
                    'Content-Type': 'text/plain;charset=utf-8',
                },
                body: JSON.stringify(dataPayload)
            });

            const resultJson = await response.json();

            if (resultJson.status === 'success') {
                showSuccess();
            } else {
                throw new Error(resultJson.message || "Gagal menyimpan data");
            }

        } catch (error) {
            console.error('Error:', error);
            loadingOverlay.classList.remove('active');
            Swal.fire({
                title: 'Terjadi Kesalahan',
                text: 'Gagal mengirim berkas. ' + error.message,
                icon: 'error',
                confirmButtonColor: '#1e3a8a'
            });
        }
    });

    function showSuccess() {
        loadingOverlay.classList.remove('active');
        Swal.fire({
            imageUrl: 'caution.jpg',
            imageAlt: 'Pemberitahuan',
            showConfirmButton: true,
            confirmButtonText: 'Close',
            confirmButtonColor: '#1e3a8a',
            allowOutsideClick: false // Memaksa user untuk klik tombol Close
        }).then(() => {
            // Reset form
            form.reset();
            // Reset file inputs kembali ke 1 input
            const wrappers = document.querySelectorAll('.file-input-wrapper');
            for (let i = 1; i < wrappers.length; i++) {
                wrappers[i].remove();
            }
            updateRemoveButtons();
        });
    }
});
