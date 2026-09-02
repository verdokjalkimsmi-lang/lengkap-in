// Konfigurasi URL Google Apps Script Web App
// GANTI URL DI BAWAH INI DENGAN URL WEB APP GAS ANDA!
const GAS_URL = 'https://script.google.com/macros/s/AKfycbzS6sgB2rfVXlnEh-HOLf9zivInN4YakvUF7DzUP5kmf0GYwNrG5NL7aMqx1-rbXGcP_g/exec';

// Ukuran maksimum sisi terpanjang gambar setelah dikompres (px)
const IMAGE_MAX_DIMENSION = 1600;
// Kualitas kompresi JPEG (0 - 1)
const IMAGE_QUALITY = 0.7;

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
    const loadingMainText = document.getElementById('loadingMainText');
    const submitBtn = document.getElementById('submitBtn');

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

    // Helper untuk mengubah file (non-gambar, mis. PDF) menjadi Base64 apa adanya
    const getBase64 = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result.split(',')[1]); // ambil data setelah koma
            reader.onerror = error => reject(error);
        });
    };

    // Kompres gambar JPG/JPEG di sisi klien (resize + turunkan kualitas)
    // Ini krusial untuk koneksi HP/seluler agar upload jauh lebih cepat dan tidak mudah gagal.
    const compressImage = (file, maxDimension = IMAGE_MAX_DIMENSION, quality = IMAGE_QUALITY) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    let { width, height } = img;

                    if (width > maxDimension || height > maxDimension) {
                        if (width > height) {
                            height = Math.round(height * (maxDimension / width));
                            width = maxDimension;
                        } else {
                            width = Math.round(width * (maxDimension / height));
                            height = maxDimension;
                        }
                    }

                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    try {
                        const dataUrl = canvas.toDataURL('image/jpeg', quality);
                        resolve(dataUrl.split(',')[1]);
                    } catch (err) {
                        reject(err);
                    }
                };
                img.onerror = reject;
                img.src = e.target.result;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    };

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // 1. Validasi Native
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        // Cegah pengiriman dobel (mis. user tap tombol berkali-kali di HP karena terasa lambat)
        submitBtn.disabled = true;

        // Jika Lanjut, tampilkan loading
        loadingMainText.textContent = 'Sedang Mengirim Berkas...';
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

            // Baca semua file input, kompres jika gambar, lalu ubah ke Base64
            const fileInputs = document.querySelectorAll('input[type="file"]');
            let fileIndex = 0;
            const totalFiles = Array.from(fileInputs).filter(i => i.files.length > 0).length;

            for (let input of fileInputs) {
                if (input.files.length > 0) {
                    fileIndex++;
                    loadingMainText.textContent = `Memproses berkas ${fileIndex} dari ${totalFiles}...`;

                    const file = input.files[0];
                    const isImage = file.type === 'image/jpeg' || file.type === 'image/jpg';

                    let base64Data;
                    let mimeType = file.type;

                    if (isImage) {
                        base64Data = await compressImage(file);
                        mimeType = 'image/jpeg';
                    } else {
                        base64Data = await getBase64(file);
                    }

                    dataPayload.files.push({
                        name: file.name,
                        mimeType: mimeType,
                        base64: base64Data
                    });
                }
            }

            loadingMainText.textContent = 'Mengunggah ke server...';

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
            submitBtn.disabled = false;

            // Kegagalan jaringan (mis. koneksi HP terputus di tengah proses) sering terjadi
            // SETELAH data sebenarnya sudah tersimpan di server, karena proses server tetap
            // berjalan meski koneksi klien terputus. Bedakan pesannya agar tidak membingungkan.
            const isNetworkError = (error instanceof TypeError) || /failed to fetch|network/i.test(error.message || '');

            if (isNetworkError) {
                Swal.fire({
                    title: 'Koneksi Terputus',
                    html: 'Koneksi internet sempat terputus saat berkas dikirim.<br><br>' +
                        'Jika ukuran berkas cukup besar, <strong>data kemungkinan sudah tersimpan</strong> di sistem kami. ' +
                        'Mohon tunggu beberapa saat, lalu hubungi petugas melalui WhatsApp jika belum menerima konfirmasi.',
                    icon: 'warning',
                    confirmButtonText: 'Mengerti',
                    confirmButtonColor: '#1e3a8a'
                });
            } else {
                Swal.fire({
                    title: 'Terjadi Kesalahan',
                    text: 'Gagal mengirim berkas. ' + error.message,
                    icon: 'error',
                    confirmButtonText: 'Tutup',
                    confirmButtonColor: '#1e3a8a'
                });
            }
        }
    });

    function showSuccess() {
        loadingOverlay.classList.remove('active');
        submitBtn.disabled = false;

        Swal.fire({
            html: `
                <div class="perhatian-card">
                    <div class="perhatian-header">
                        <svg class="perhatian-tri" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                            <polygon points="50,8 95,90 5,90" fill="#ffffff" stroke="#0a1a3a" stroke-width="8"/>
                            <rect x="45" y="34" width="10" height="30" fill="#0a1a3a"/>
                            <circle cx="50" cy="76" r="6.5" fill="#0a1a3a"/>
                        </svg>
                        <h2>PERHATIAN</h2>
                        <svg class="perhatian-tri" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                            <polygon points="50,8 95,90 5,90" fill="#ffffff" stroke="#0a1a3a" stroke-width="8"/>
                            <rect x="45" y="34" width="10" height="30" fill="#0a1a3a"/>
                            <circle cx="50" cy="76" r="6.5" fill="#0a1a3a"/>
                        </svg>
                    </div>
                    <div class="perhatian-body">
                        <p class="line1">TERIMA KASIH TELAH MELENGKAPI BERKAS<br>PERMOHONAN PASPOR ANDA</p>
                        <hr>
                        <p class="line2">UNGGAHAN DOKUMEN AKAN DIVERIFIKASI OLEH PETUGAS
                            <span class="highlight">MAKSIMAL 1 HARI KERJA</span>
                        </p>
                        <p class="line3">INFORMASI LEBIH LANJUT AKAN KAMI SAMPAIKAN SECARA BERKALA MELALUI
                            NOMOR WHATSAPP: <strong>0811-1115-945</strong></p>
                    </div>
                    <div class="perhatian-footer">
                        <img src="LOGO_KEMENTERIAN.png" alt="Logo Kementerian Imigrasi dan Pemasyarakatan">
                        <div class="footer-text">KANTOR IMIGRASI<br>KELAS I NON TPI SUKABUMI</div>
                        <img src="LOGO_IMIGRASI.png" alt="Logo Imigrasi">
                    </div>
                </div>
            `,
            width: 560,
            padding: 0,
            background: '#ffffff',
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
