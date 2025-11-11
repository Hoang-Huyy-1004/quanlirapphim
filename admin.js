document.addEventListener("DOMContentLoaded", () => {
  console.log("✅ JS loaded thành công");
  // API của chúng ta trỏ đến tệp PHP
  const apiUrl = "http://localhost/HTTT_DL/quanlirapphim/api.php";
  // const apiUrl = "http://localhost/quanlirapphim/api.php";

  const form = document.getElementById("cinema-form");
  const tableBody = document.getElementById("cinema-table-body");
  const formTitle = document.getElementById("form-title");
  const cinemaIdInput = document.getElementById("cinema-id");
  const btnCancel = document.getElementById("btn-cancel");

  // Các ô nhập liệu
  const nameInput = document.getElementById("name");
  const provinceInput = document.getElementById("province");
  const addressInput = document.getElementById("address");
  const latitudeInput = document.getElementById("latitude");
  const longitudeInput = document.getElementById("longitude");
  const screensInput = document.getElementById("screens");
  const moviesInput = document.getElementById("movies");

  // 1. LẤY VÀ HIỂN THỊ DANH SÁCH RẠP
  async function fetchCinemas() {
    try {
      const response = await fetch(apiUrl);
      const cinemas = await response.json();

      tableBody.innerHTML = "";
      cinemas.forEach((cinema) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
                    <td>${cinema.name}</td>
                    <td>${cinema.province}</td>
                    <td>${(cinema.movies || []).join(", ")}</td>
                    <td>
                        <button class="btn btn-warning btn-sm btn-edit" data-id="${
                          cinema.id
                        }">Sửa</button>
                        <button class="btn btn-danger btn-sm btn-delete" data-id="${
                          cinema.id
                        }">Xóa</button>
                    </td>
                `;
        tableBody.appendChild(tr);
      });
    } catch (error) {
      console.error("Lỗi tải rạp:", error);
    }
  }

  // 2. XỬ LÝ NÚT SUBMIT (THÊM HOẶC SỬA)
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const id = cinemaIdInput.value ? parseInt(cinemaIdInput.value) : null;

    try {
      // Tạo formData cho cả thêm và sửa
      const formData = new FormData();
      formData.append("id", id || "");
      formData.append("name", nameInput.value);
      formData.append("province", provinceInput.value);
      formData.append("address", addressInput.value);
      formData.append("latitude", latitudeInput.value);
      formData.append("longitude", longitudeInput.value);
      formData.append("screens", screensInput.value);
      formData.append("movies", moviesInput.value);

      const fileInput = document.getElementById("image");
      if (fileInput.files.length > 0) {
        formData.append("image", fileInput.files[0]);
      }

      console.log([...formData.entries()]);

      await fetch(apiUrl, {
        method: "POST", // dùng POST cho cả thêm và sửa
        body: formData,
      });

      resetForm();
      fetchCinemas();
    } catch (error) {
      console.error("Lỗi khi lưu:", error);
    }
  });

  // 3. XỬ LÝ CÁC NÚT BẤM (SỬA, XÓA, HỦY)
  tableBody.addEventListener("click", async (e) => {
    const target = e.target;
    const id = target.dataset.id;

    // XÓA
    if (target.classList.contains("btn-delete")) {
      if (confirm("Bạn có chắc muốn xóa rạp này?")) {
        try {
          // Gửi ID trong URL
          await fetch(`${apiUrl}?id=${id}`, { method: "DELETE" });
          fetchCinemas();
        } catch (error) {
          console.error("Lỗi khi xóa:", error);
        }
      }
    }

    if (target.classList.contains("btn-edit")) {
      const response = await fetch(apiUrl);
      const cinemas = await response.json();
      const cinema = cinemas.find((c) => c.id == id);

      if (cinema) {
        formTitle.innerText = "Sửa Rạp Phim";
        cinemaIdInput.value = cinema.id;
        nameInput.value = cinema.name;
        provinceInput.value = cinema.province;
        addressInput.value = cinema.address;
        latitudeInput.value = cinema.latitude;
        longitudeInput.value = cinema.longitude;
        screensInput.value = cinema.screens;
        moviesInput.value = (cinema.movies || []).join(", ");
        btnCancel.classList.remove("d-none");
        window.scrollTo(0, 0);
      }
    }
  });

  // Nút Hủy Sửa
  btnCancel.addEventListener("click", resetForm);

  function resetForm() {
    form.reset();
    formTitle.innerText = "Thêm Rạp Mới";
    cinemaIdInput.value = "";
    btnCancel.classList.add("d-none");
  }

  // Tải danh sách rạp khi mở trang
  fetchCinemas();
});
