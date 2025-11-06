document.addEventListener("DOMContentLoaded", function () {
  // Khởi tạo bản đồ
  var map = L.map("map").setView([10.0336, 105.7876], 13);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map);

  // Kiểm tra dữ liệu có tồn tại không
  if (typeof cinemas === "undefined") {
    console.error("❌ Không tìm thấy dữ liệu 'cinemas' trong data.js");
    return;
  }

  // Thêm marker các rạp phim
  cinemas.forEach((c) => {
    L.marker([c.latitude, c.longitude])
      .addTo(map)
      .bindPopup(`<strong>${c.name}</strong><br>${c.address}`);
  });

  // Tìm kiếm rạp phim
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
      map.flyTo([found.latitude, found.longitude], 16);
      L.marker([found.latitude, found.longitude])
        .addTo(map)
        .bindPopup(`<strong>${found.name}</strong><br>${found.address}`)
        .openPopup();
    } else {
      alert("Không tìm thấy rạp nào khớp với từ khóa!");
    }
  });
});
