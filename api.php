<?php
$servername = "localhost";
$username = "root";
$password = "@datacuatrungtin";
$dbname = "cinema_gis";
$port = 3306;
//Đổi lại port của mình đang sử dụng
// Cho phép JavaScript từ bất kỳ đâu gọi (CORS)
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

// Tạo kết nối
$conn = new mysqli($servername, $username, $password, $dbname, $port);
if ($conn->connect_error) {
    die(json_encode(["error" => "Connection failed: " . $conn->connect_error]));
}
mysqli_set_charset($conn, "utf8");

$method = $_SERVER['REQUEST_METHOD'];
$id = isset($_GET['id']) ? intval($_GET['id']) : null;

switch ($method) {
    // LẤY DỮ LIỆU
    case 'GET':
        $sql = "SELECT * FROM cinemas";
        if ($id !== null) {
            $sql .= " WHERE id = $id";
        }
        $result = $conn->query($sql);
        $rows = array();
        while ($r = $result->fetch_assoc()) {
            // Chuyển đổi chuỗi JSON phim từ CSDL thành mảng
            $r['movies'] = json_decode($r['movies']);
            $rows[] = $r;
        }
        echo json_encode($rows);
        break;

    // THÊM MỚI
    case 'POST':
        // Nếu có id => UPDATE, nếu không => INSERT
        $id = $_POST['id'] ?? null;
        $name = $_POST['name'] ?? '';
        $address = $_POST['address'] ?? '';
        $province = $_POST['province'] ?? '';
        $screens = intval($_POST['screens'] ?? 0);
        $movies = json_encode(explode(',', $_POST['movies'] ?? ''));
        $latitude = floatval($_POST['latitude'] ?? 0);
        $longitude = floatval($_POST['longitude'] ?? 0);
        $image_url = null;

        // --- Xử lý ảnh (nếu có)
        if (isset($_FILES['image']) && $_FILES['image']['error'] === UPLOAD_ERR_OK) {
            $targetDir = __DIR__ . "/images/"; // đường dẫn tuyệt đối
            if (!is_dir($targetDir))
                mkdir($targetDir, 0777, true);

            $fileName = time() . "_" . basename($_FILES['image']['name']);
            $targetFile = $targetDir . $fileName;

            if (move_uploaded_file($_FILES['image']['tmp_name'], $targetFile)) {
                $image_url = "images/" . $fileName; // chỉ lưu đường dẫn tương đối vào DB
            }
        }

        if ($id) {
            // --- Cập nhật rạp (nếu không upload ảnh mới thì giữ ảnh cũ)
            $old = $conn->query("SELECT image_url FROM cinemas WHERE id=$id")->fetch_assoc();
            if (!$image_url)
                $image_url = $old['image_url'];

            $stmt = $conn->prepare("UPDATE cinemas 
                                SET name=?, address=?, province=?, screens=?, movies=?, latitude=?, longitude=?, image_url=? 
                                WHERE id=?");
            $stmt->bind_param("sssisddsi", $name, $address, $province, $screens, $movies, $latitude, $longitude, $image_url, $id);
            $stmt->execute();
            echo json_encode(["message" => "Cập nhật thành công"]);
            $stmt->close();
        } else {
            // --- Thêm rạp mới
            $stmt = $conn->prepare("INSERT INTO cinemas (name, address, province, screens, movies, latitude, longitude, image_url) 
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
            $stmt->bind_param("sssisdds", $name, $address, $province, $screens, $movies, $latitude, $longitude, $image_url);
            $stmt->execute();
            echo json_encode(["message" => "Thêm rạp thành công"]);
            $stmt->close();
        }
        break;

    // SỬA
    case 'PUT':
        $data = json_decode(file_get_contents("php://input"));

        $sql = $conn->prepare("UPDATE cinemas SET name=?, address=?, province=?, screens=?, movies=?, latitude=?, longitude=? WHERE id=?");
        $moviesJson = json_encode($data->movies);
        $sql->bind_param("sssisddi", $data->name, $data->address, $data->province, $data->screens, $moviesJson, $data->latitude, $data->longitude, $data->id);

        if ($sql->execute()) {
            echo json_encode(["message" => "Cập nhật thành công"]);
        } else {
            echo json_encode(["error" => "Cập nhật thất bại: " . $conn->error]);
        }
        $sql->close();
        break;

    // XÓA
    case 'DELETE':
        if ($id === null) {
            echo json_encode(["error" => "Cần ID để xóa"]);
            break;
        }

        $sql = $conn->prepare("DELETE FROM cinemas WHERE id = ?");
        $sql->bind_param("i", $id);

        if ($sql->execute()) {
            echo json_encode(["message" => "Xóa thành công"]);
        } else {
            echo json_encode(["error" => "Xóa thất bại: " . $conn->error]);
        }
        $sql->close();
        break;
}

$conn->close();
?>