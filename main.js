document.addEventListener("DOMContentLoaded", function () {
  // 1️⃣ Khởi tạo bản đồ
  var map = L.map("map").setView([10.0336, 105.7876], 11);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map);

  if (typeof cinemas === "undefined") {
    console.error("❌ Không tìm thấy dữ liệu 'cinemas' trong data.js");
    return;
  }

  // 2️⃣ Quản lý các marker
  let markers = [];

  function renderMarkers(list) {
    // Xóa marker cũ
    markers.forEach((m) => map.removeLayer(m));
    markers = [];

    // Nếu không có dữ liệu
    if (!list || list.length === 0) {
      alert("Không tìm thấy rạp nào khớp với tiêu chí!");
      return;
    }

    // Thêm marker mới
    list.forEach((c) => {
      const marker = L.marker([c.latitude, c.longitude])
        .addTo(map)
        .bindPopup(`<strong>${c.name}</strong><br>${c.address}`);
      markers.push(marker);
    });

    // Zoom vào cụm rạp
    const group = new L.featureGroup(markers);
    map.fitBounds(group.getBounds(), { padding: [50, 50] });
  }

  // Lần đầu hiển thị tất cả rạp
  renderMarkers(cinemas);

  // 3️⃣ Xử lý tìm kiếm
  const searchForm = document.getElementById("cinemaSearchForm");
  const searchInput = document.getElementById("searchInput");

  searchForm.addEventListener("submit", function (e) {
    e.preventDefault();
    const query = searchInput.value.trim().toLowerCase();
    if (!query) return;

    const found = cinemas.find(
      (c) =>
        c.name.toLowerCase().includes(query) ||
        c.address.toLowerCase().includes(query)
    );

    if (found) {
      map.flyTo([found.latitude, found.longitude], 15);
      L.popup()
        .setLatLng([found.latitude, found.longitude])
        .setContent(`<strong>${found.name}</strong><br>${found.address}`)
        .openOn(map);
    } else {
      alert("❌ Không tìm thấy rạp nào khớp với từ khóa!");
    }
  });

  // 4️⃣ Xử lý lọc theo tỉnh/thành
  const btnFilter = document.getElementById("btnFilter");
  const filterProvince = document.getElementById("filterProvince");

  btnFilter.addEventListener("click", () => {
    const province = filterProvince.value.trim();
    let filtered = cinemas;

    if (province) {
      filtered = cinemas.filter((c) => {
        if (c.province) {
          return c.province.toLowerCase() === province.toLowerCase();
        }
        // fallback: kiểm tra chuỗi address
        return c.address.toLowerCase().includes(province.toLowerCase());
      });
    }

    renderMarkers(filtered);
  });
});
