document.addEventListener("DOMContentLoaded", function () {
  // Khởi tạo bản đồ
  // preferCanvas giúp vẽ nhiều hình (polygon) mượt hơn
  var map = L.map("map", { preferCanvas: true }).setView(
    [10.0336, 105.7876],
    11
  );
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map);

  // Quản lý các biến
  let markers = [];
  let myChart = null;
  let userLocation = null;
  let routingControl = null;
  let chartDrawn = false;
  let provincesLayer = null; // Lớp GeoJSON các tỉnh
  let provinceCinemaCounts = {};
  const provinceColors = {
    "Cần Thơ": "#ff6384",
    "Vĩnh Long": "#36a2eb",
    "Hậu Giang": "#ffcd56",
    "Sóc Trăng": "#4bc0c0",
    "Kiên Giang": "#9966ff",
    "An Giang": "#ff9f40",
    "Đồng Tháp": "#c9cbcf",
  };

  let cinemas = [];
  const apiUrl = "http://localhost/HTTT_DL/quanlirapphim/api.php";
  // const apiUrl = "http://localhost/quanlirapphim/api.php";

  async function loadDataAndInit() {
    try {
      await loadVietnamProvinces(); // tải GeoJSON trước

      const response = await fetch(apiUrl);
      if (!response.ok) throw new Error("Không thể tải CSDL rạp phim");

      cinemas = await response.json();
      console.log("✅ Dữ liệu từ API:", cinemas);

      calculateProvinceCounts(cinemas);
      updateProvinceColors();

      updateStatCards(cinemas);
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

  // Tải và vẽ polygon ranh giới tỉnh/thành từ file GeoJSON
  async function loadVietnamProvinces() {
    try {
      const res = await fetch("gadm41_VNM_1.json");
      if (!res.ok) throw new Error("Không thể tải GeoJSON tỉnh/thành");
      const geojson = await res.json();

      provincesLayer = L.geoJSON(geojson, {
        style: function () {
          return {
            color: "#444",
            weight: 1,
            fillColor: "#cccccc",
            fillOpacity: 0.3,
          };
        },
        onEachFeature: function (feature, layer) {
          const name =
            feature.properties?.NAME_1 ||
            feature.properties?.VARNAME_1 ||
            "Không rõ";

          layer.bindTooltip(name, { sticky: true });

          layer.options.originalStyle = {
            color: "#444",
            weight: 1,
            fillColor: "#cccccc",
            fillOpacity: 0.3,
          };

          layer.on({
            mouseover: function (e) {
              const target = e.target;
              target.setStyle({
                weight: 2,
                color: "#ff6600",
                fillOpacity: 0.9,
              });
              if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
                target.bringToFront();
              }
            },
            mouseout: function (e) {
              const target = e.target;
              const original = target.options.originalStyle;
              target.setStyle(original);
            },
            click: function (e) {
              map.fitBounds(e.target.getBounds(), { padding: [20, 20] });
            },
          });
        },
      }).addTo(map);

      provincesLayer.bringToBack();
    } catch (err) {
      console.error("Lỗi tải GeoJSON:", err);
    }
  }

  // Đếm số lượng rạp theo tỉnh
  function calculateProvinceCounts(cinemas) {
    provinceCinemaCounts = cinemas.reduce((acc, c) => {
      const province = c.province?.trim();
      if (province) acc[province] = (acc[province] || 0) + 1;
      return acc;
    }, {});
    console.log("✅ Số lượng rạp theo tỉnh:", provinceCinemaCounts);
  }

  // Màu theo số lượng rạp
  function getColorByCount(provinceName, count) {
    const baseColor = provinceColors[provinceName] || "#dddddd";
    const opacity = count > 0 ? Math.min(0.3 + count * 0.05, 0.9) : 0.15;
    return { color: baseColor, opacity: opacity };
  }

  // Chuẩn hoá tên tỉnh/thành để so khớp tiếng Việt - không dấu
  function normalizeProvinceName(name) {
    if (!name) return "";
    return name
      .normalize("NFD") // tách dấu tiếng Việt
      .replace(/[\u0300-\u036f]/g, "") // xóa dấu
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D")
      .toLowerCase()
      .replace(/tp\.?|tinh|thanhpho|thanh pho/g, "") // bỏ tiền tố hành chính
      .replace(/[^a-z0-9]/g, "") // bỏ mọi ký tự đặc biệt, khoảng trắng, gạch nối
      .trim();
  }

  function updateProvinceColors() {
    if (!provincesLayer) return;

    provincesLayer.eachLayer((layer) => {
      const name =
        layer.feature?.properties?.NAME_1 ||
        layer.feature?.properties?.VARNAME_1 ||
        "";
      const normalizedGeo = normalizeProvinceName(name);

      const matchingKey = Object.keys(provinceCinemaCounts).find(
        (p) => normalizeProvinceName(p) === normalizedGeo
      );

      const count = provinceCinemaCounts[matchingKey] || 0;
      const { color, opacity } = getColorByCount(matchingKey, count);

      layer.setStyle({
        fillColor: color,
        fillOpacity: opacity,
        color: "#333",
        weight: 1,
      });

      layer.options.originalStyle = {
        fillColor: color,
        fillOpacity: opacity,
        color: "#333",
        weight: 1,
      };

      layer.bindTooltip(`${name}: ${count} rạp`, {
        sticky: true,
        direction: "center",
        opacity: 0.95,
      });
    });

    provincesLayer.bringToBack();
  }

  function renderMarkers(list) {
    markers.forEach((m) => map.removeLayer(m));
    markers = [];

    if (!list || list.length === 0) {
      alert("Không tìm thấy rạp nào khớp với tiêu chí!");
      return;
    }

    list.forEach((c) => {
      const name = c.name.toLowerCase();
      let iconUrl = "https://cdn-icons-png.flaticon.com/512/684/684908.png"; // mặc định (màu xám)

      if (name.includes("cgv")) {
        iconUrl = "icons/icon-CGV.png";
      } else if (name.includes("lotte")) {
        iconUrl = "icons/icon-lotte.png";
      } else if (name.includes("dcine")) {
        iconUrl = "icons/icon-bhd.png";
      } else if (name.includes("cinestar")) {
        iconUrl = "icons/icon-cinestar.png";
      } else if (name.includes("galaxy")) {
        iconUrl = "icons/icon-galaxy.png";
      }

      const movieHtml =
        c.movies && c.movies.length > 0
          ? `<br><i>Đang chiếu: ${c.movies.join(", ")}</i>`
          : "";
      const screensHtml = c.screens ? `<br>Số phòng: ${c.screens}` : "";

      const imageHtml = c.image_url
        ? `<br><img src="${c.image_url}" style="width:100%;max-width:200px;border-radius:8px;margin-top:6px;">`
        : "";

      const popupContent = `
        <div style="max-width:240px;">
          <strong>${c.name}</strong><br>
          ${c.address}
          ${imageHtml}
          ${screensHtml}
          ${movieHtml}
          <br>
          <button class="btn btn-primary btn-sm btn-directions" 
                  data-lat="${c.latitude}" 
                  data-lon="${c.longitude}">
            <i class="fas fa-directions"></i> Chỉ đường
          </button>
        </div>
      `;

      const marker = L.marker([c.latitude, c.longitude], {
        icon: L.icon({
          iconUrl: iconUrl,
          iconSize: [32, 32],
          iconAnchor: [16, 32],
          popupAnchor: [0, -32],
        }),
      })
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
      waypoints: [
        L.latLng(userLocation.lat, userLocation.lng),
        destinationLatLng,
      ],
      routeWhileDragging: true,
      show: true,
      createMarker: function () {
        return null;
      },
    }).addTo(map);
    map.closePopup();
  }

  // Xử lý tìm kiếm
  function setupSearch() {
    const searchForm = document.getElementById("cinemaSearchForm");
    const searchInput = document.getElementById("searchInput");
    searchForm.addEventListener("submit", function (e) {
      e.preventDefault();
      const query = searchInput.value.trim().toLowerCase();
      if (!query) {
        renderMarkers(cinemas);
        return;
      }
      const results = cinemas.filter(
        (c) =>
          c.name.toLowerCase().includes(query) ||
          c.address.toLowerCase().includes(query) ||
          (c.movies &&
            c.movies.some((movie) => movie.toLowerCase().includes(query)))
      );
      renderMarkers(results);
    });
  }

  // HÀM MỚI: Cập nhật các thẻ thống kê nhanh
  function updateStatCards(cinemas) {
    if (!cinemas) return;

    // 1. Tổng số rạp
    const totalCinemas = cinemas.length;

    // 2. Tổng số tỉnh
    // Tạo một Set (bộ) chỉ chứa các giá trị province duy nhất
    const uniqueProvinces = new Set(
      cinemas.map((c) => c.province).filter((p) => p)
    );
    const totalProvinces = uniqueProvinces.size;

    // 3. Tổng phòng chiếu (lấy từ cột 'screens')
    const totalScreens = cinemas.reduce((acc, cinema) => {
      // Dùng Number() để cộng, nếu cinema.screens bị null thì coi như là 0
      return acc + (Number(cinema.screens) || 0);
    }, 0);

    // 4. Tổng số phim đang chiếu (unique) (lấy từ cột 'movies')
    const allMovies = new Set();
    cinemas.forEach((cinema) => {
      // File api.php đã tự động chuyển 'movies' thành mảng
      if (cinema.movies && Array.isArray(cinema.movies)) {
        cinema.movies.forEach((movie) => allMovies.add(movie));
      }
    });
    const totalUniqueMovies = allMovies.size;

    // Cập nhật số liệu lên HTML
    document.getElementById("statTotalCinemas").innerText = totalCinemas;
    document.getElementById("statTotalProvinces").innerText = totalProvinces;
    document.getElementById("statTotalScreens").innerText = totalScreens;

    // Cập nhật ô cuối cùng với số phim
    document.getElementById("statCanThoCinemas").innerText = totalUniqueMovies;
  }

  // Xử lý lọc
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

  // Xử lý thống kê
  function setupStatsChart() {
    const statsCollapseEl = document.getElementById("statsCollapse");
    statsCollapseEl.addEventListener("shown.bs.collapse", function () {
      if (chartDrawn) return;
      if (typeof cinemas === "undefined" || cinemas.length === 0) return;

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
          datasets: [
            {
              label: "Số lượng rạp",
              data: data,
              backgroundColor: [
                "rgba(255, 99, 132, 0.7)",
                "rgba(54, 162, 235, 0.7)",
                "rgba(255, 206, 86, 0.7)",
                "rgba(75, 192, 192, 0.7)",
                "rgba(153, 102, 255, 0.7)",
                "rgba(255, 159, 64, 0.7)",
                "rgba(201, 203, 207, 0.7)",
              ],
              borderColor: [
                "rgb(255, 99, 132)",
                "rgb(54, 162, 235)",
                "rgb(255, 206, 86)",
                "rgb(75, 192, 192)",
                "rgb(153, 102, 255)",
                "rgb(255, 159, 64)",
                "rgb(201, 203, 207)",
              ],
              borderWidth: 1,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          plugins: {
            legend: {
              display: true,
              position: "bottom",
              labels: { boxWidth: 12, font: { size: 10 } },
            },
            title: {
              display: true,
              text: "Tỉ Lệ Rạp Theo Tỉnh",
              font: { size: 14 },
            },
          },
        },
      });
      chartDrawn = true;
    });
  }

  loadDataAndInit();
});
