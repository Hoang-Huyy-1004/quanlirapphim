document.addEventListener("DOMContentLoaded", function () {
  // 1️⃣ Khởi tạo bản đồ
  var map = L.map("map").setView([10.0336, 105.7876], 11);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map);

  // 2️⃣ Quản lý các biến
  let markers = [];
  let myChart = null;
  let userLocation = null;
  let routingControl = null;
  let chartDrawn = false;
  
  let cinemas = [];
  const apiUrl = 'http://localhost/HTTT_DL/quanlirapphim/api.php';

  
  async function loadDataAndInit() {
      try {
          const response = await fetch(apiUrl);
          if (!response.ok) throw new Error('Không thể tải CSDL rạp phim');
          
          cinemas = await response.json();

          getLocation(); 
          renderMarkers(cinemas); 
          setupPopupListener(); 
          
          setupSearch();
          setupFilter();
          setupStatsChart();

      } catch (error) {
          console.error(error);
          alert("Lỗi kết nối CSDL: " + error.message);
      }
  }
  
  function renderMarkers(list) {
    markers.forEach((m) => map.removeLayer(m));
    markers = [];

    if (!list || list.length === 0) {
      alert("Không tìm thấy rạp nào khớp với tiêu chí!");
      return;
    }

    list.forEach((c) => {
      const movieHtml =
        c.movies && c.movies.length > 0
          ? `<br><i>Đang chiếu: ${c.movies.join(", ")}</i>`
          : "";
      const screensHtml = c.screens ? `<br>Số phòng: ${c.screens}` : "";

      const popupContent = `
        <strong>${c.name}</strong><br>
        ${c.address}
        ${screensHtml}
        ${movieHtml}
        <br>
        <button class="btn btn-primary btn-sm btn-directions" 
                data-lat="${c.latitude}" 
                data-lon="${c.longitude}">
          <i class="fas fa-directions"></i> Chỉ đường
        </button>
      `;

      const marker = L.marker([c.latitude, c.longitude])
        .addTo(map)
        .bindPopup(popupContent);
      markers.push(marker);
    });

    if (list.length !== cinemas.length && list.length > 0) {
      const group = new L.featureGroup(markers);
      map.fitBounds(group.getBounds(), { padding: [50, 50] });
    }
  }

  function getLocation() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(showPosition, showError);
    } else {
      console.log("Trình duyệt không hỗ trợ Geolocation.");
    }
  }

  function showPosition(position) {
    const lat = position.coords.latitude;
    const lon = position.coords.longitude;
    userLocation = L.latLng(lat, lon); 

    map.setView(userLocation, 14); 

    L.marker(userLocation, {
      icon: L.icon({
        iconUrl: "https://cdn-icons-png.flaticon.com/512/684/684908.png",
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32],
      }),
    })
      .addTo(map)
      .bindPopup("<b>Vị trí của bạn</b>")
      .openPopup();
  }

  function showError(error) {
    if (error.code === error.PERMISSION_DENIED) {
      alert("Bạn đã từ chối cho phép truy cập vị trí.");
    }
  }

  function setupPopupListener() {
    map.on("popupopen", function (e) {
      const btn = e.popup._container.querySelector(".btn-directions");
      if (btn) {
        btn.addEventListener("click", (event) => {
          const lat = event.target.dataset.lat;
          const lon = event.target.dataset.lon;
          const destination = L.latLng(lat, lon);
          showDirections(destination);
        });
      }
    });
  }

  function showDirections(destinationLatLng) {
    if (!userLocation) {
      alert("Vui lòng cho phép truy cập vị trí của bạn để dùng chức năng này.");
      return;
    }
    if (routingControl) {
      map.removeControl(routingControl);
      routingControl = null;
    }
    routingControl = L.Routing.control({
      waypoints: [L.latLng(userLocation.lat, userLocation.lng), destinationLatLng],
      routeWhileDragging: true,
      show: true,
      createMarker: function () { return null; },
    }).addTo(map);
    map.closePopup();
  }
  
  // 3️⃣ Xử lý tìm kiếm
  function setupSearch() {
      const searchForm = document.getElementById("cinemaSearchForm");
      const searchInput = document.getElementById("searchInput");
      searchForm.addEventListener("submit", function (e) {
          e.preventDefault();
          const query = searchInput.value.trim().toLowerCase();
          if (!query) { renderMarkers(cinemas); return; }
          const results = cinemas.filter(
              (c) =>
                  c.name.toLowerCase().includes(query) ||
                  c.address.toLowerCase().includes(query) ||
                  (c.movies && c.movies.some((movie) => movie.toLowerCase().includes(query)))
          );
          renderMarkers(results);
      });
  }

  // 4️⃣ Xử lý lọc
  function setupFilter() {
      const btnFilter = document.getElementById("btnFilter");
      const filterProvince = document.getElementById("filterProvince");
      btnFilter.addEventListener("click", () => {
          const province = filterProvince.value.trim();
          let filtered = cinemas;
          if (province) {
              filtered = cinemas.filter((c) => c.province === province);
          }
          renderMarkers(filtered);
      });
  }

  // 5️⃣ Xử lý thống kê
  function setupStatsChart() {
      const statsCollapseEl = document.getElementById("statsCollapse");
      statsCollapseEl.addEventListener("shown.bs.collapse", function () {
          if (chartDrawn) return;
          if (typeof cinemas === 'undefined' || cinemas.length === 0) return;
          
          const provinceCounts = cinemas.reduce((acc, cinema) => {
              const province = cinema.province || "Không rõ";
              acc[province] = (acc[province] || 0) + 1;
              return acc;
          }, {});
          const labels = Object.keys(provinceCounts);
          const data = Object.values(provinceCounts);
          const ctx = document.getElementById("sidebarChart");
          if (!ctx) return;
          if (myChart) myChart.destroy();
          myChart = new Chart(ctx.getContext("2d"), {
              type: "pie",
              data: {
                  labels: labels,
                  datasets: [{
                      label: "Số lượng rạp",
                      data: data,
                      backgroundColor: ["rgba(255, 99, 132, 0.7)", "rgba(54, 162, 235, 0.7)", "rgba(255, 206, 86, 0.7)", "rgba(75, 192, 192, 0.7)", "rgba(153, 102, 255, 0.7)", "rgba(255, 159, 64, 0.7)", "rgba(201, 203, 207, 0.7)"],
                      borderColor: ["rgb(255, 99, 132)", "rgb(54, 162, 235)", "rgb(255, 206, 86)", "rgb(75, 192, 192)", "rgb(153, 102, 255)", "rgb(255, 159, 64)", "rgb(201, 203, 207)"],
                      borderWidth: 1
                  }]
              },
              options: {
                  responsive: true,
                  maintainAspectRatio: true,
                  plugins: {
                      legend: { display: true, position: "bottom", labels: { boxWidth: 12, font: { size: 10 } } },
                      title: { display: true, text: "Tỉ Lệ Rạp Theo Tỉnh", font: { size: 14 } }
                  }
              }
          });
          chartDrawn = true;
      });
  }
  
  loadDataAndInit();
});