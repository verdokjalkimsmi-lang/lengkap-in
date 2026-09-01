// Konfigurasi URL Google Apps Script Web App
// GANTI URL DI BAWAH INI DENGAN URL WEB APP GAS ANDA!
const GAS_URL = 'https://script.google.com/macros/s/AKfycbyWeDqbg6hFfuNeSkYDF3f0mfVxM0NJ3OdPnUWviZ-zqB7IDWbBhIEYTRE82gOTJ7_nlA/exec';

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

    // Helper untuk mengubah file menjadi Base64
    const getBase64 = (file) => {
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

            const dataPayload = {
                nama_pemohon: formData.get('nama_pemohon'),
                nomor_pemohon: formData.get('nomor_pemohon'),
                ttl: formData.get('tempat_lahir') + ', ' + formattedDate,
                no_whatsapp: formData.get('no_whatsapp'),
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
