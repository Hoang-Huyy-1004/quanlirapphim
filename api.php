<?php
$servername = "localhost";
$username = "root";
$password = "";
$dbname = "cinema_gis";

// Cho phép JavaScript từ bất kỳ đâu gọi (CORS)
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

// Tạo kết nối
$conn = new mysqli($servername, $username, $password, $dbname);
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
        $data = json_decode(file_get_contents("php://input"));
        
        $sql = $conn->prepare("INSERT INTO cinemas (name, address, province, screens, movies, latitude, longitude) VALUES (?, ?, ?, ?, ?, ?, ?)");
        $moviesJson = json_encode($data->movies); // Chuyển mảng phim thành chuỗi JSON
        $sql->bind_param("sssisdd", $data->name, $data->address, $data->province, $data->screens, $moviesJson, $data->latitude, $data->longitude);
        
        if ($sql->execute()) {
            echo json_encode(["message" => "Thêm rạp thành công", "id" => $conn->insert_id]);
        } else {
            echo json_encode(["error" => "Thêm rạp thất bại: " . $conn->error]);
        }
        $sql->close();
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