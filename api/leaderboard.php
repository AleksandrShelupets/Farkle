<?php
// leaderboard.php — спільний рейтинг гравців через JSON-файл (без БД).
// Дії: list (GET) — усі гравці; register (POST) — зайняти ім'я; submit (POST) — оновити показники.
// Унікальність імені без авторизації: кожен браузер має випадковий clientId, що стає
// «власником» імені. Те саме ім'я з тим самим clientId = це ви; чужий clientId → зайнято.

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

// Шим на випадок відсутності mbstring (рідко на shared-хостингу).
if (!function_exists('mb_strlen')) {
  function mb_strlen($s, $e = null) { return strlen($s); }
  function mb_strtolower($s, $e = null) { return strtolower($s); }
}

$FILE = __DIR__ . '/../data/leaderboard.json';
$MAX_PLAYERS = 2000;
$NAME_MIN = 2;
$NAME_MAX = 16;
$CAP = 100000000;        // стеля для очкових показників (захист від абсурду)
$CAP_TURNS = 1000000;    // стеля для соло-ходів

function out($arr, $code = 200) {
  http_response_code($code);
  echo json_encode($arr, JSON_UNESCAPED_UNICODE);
  exit;
}
function fail($error, $code = 400) { out(array('ok' => false, 'error' => $error), $code); }

function load_locked($fp) {
  rewind($fp);
  $raw = stream_get_contents($fp);
  $data = json_decode($raw, true);
  if (!is_array($data) || !isset($data['players']) || !is_array($data['players'])) {
    $data = array('players' => array());
  }
  return $data;
}
function save_locked($fp, $data) {
  if (empty($data['players'])) $data['players'] = new stdClass(); // {} замість []
  $json = json_encode($data, JSON_UNESCAPED_UNICODE);
  ftruncate($fp, 0);
  rewind($fp);
  fwrite($fp, $json);
  fflush($fp);
}

function clean_name($name) {
  $name = trim((string)$name);
  $name = preg_replace('/[\x00-\x1F\x7F]/u', '', $name); // прибрати керівні символи
  return $name;
}
function valid_name($name) {
  global $NAME_MIN, $NAME_MAX;
  if ($name === '') return false;
  $len = mb_strlen($name, 'UTF-8');
  if ($len < $NAME_MIN || $len > $NAME_MAX) return false;
  return (bool)preg_match('/^[\p{L}\p{N} _.\-]+$/u', $name); // літери (вкл. кирилицю), цифри, пробіл, _.-
}
function norm_key($name) { return mb_strtolower($name, 'UTF-8'); }

function clean_id($id) {
  $id = (string)$id;
  return preg_match('/^[A-Za-z0-9_-]{6,64}$/', $id) ? $id : '';
}
function clamp_int($v, $min, $max) {
  $v = (int)$v;
  if ($v < $min) return $min;
  if ($v > $max) return $max;
  return $v;
}
function new_player($name, $id) {
  $t = time();
  return array(
    'name' => $name, 'owner' => $id,
    'bestSingleTurn' => 0,
    'aiWins' => 0, 'aiLosses' => 0, 'aiGames' => 0,
    'soloBestTurns' => null, 'soloGames' => 0,
    'farkles' => 0, 'farklePoints' => 0,
    'attackBest' => 0,
    'dailyDate' => '', 'dailyScore' => 0,
    'created' => $t, 'updated' => $t
  );
}

$method = $_SERVER['REQUEST_METHOD'];
$body = ($method === 'POST') ? file_get_contents('php://input') : '';
$payload = ($body !== '') ? json_decode($body, true) : null;
if (!is_array($payload)) $payload = ($method === 'POST') ? $_POST : $_GET;

$action = '';
if (isset($_GET['action'])) $action = $_GET['action'];
elseif (isset($payload['action'])) $action = $payload['action'];
elseif ($method === 'GET') $action = 'list';

$dir = dirname($FILE);
if (!is_dir($dir)) @mkdir($dir, 0775, true);

// ---------- LIST ----------
if ($action === 'list') {
  $fp = @fopen($FILE, 'c+');
  if (!$fp) fail('storage', 500);
  flock($fp, LOCK_SH);
  $data = load_locked($fp);
  flock($fp, LOCK_UN);
  fclose($fp);

  $public = array();
  foreach ($data['players'] as $p) {
    $public[] = array(
      'name' => isset($p['name']) ? $p['name'] : '',
      'bestSingleTurn' => (int)(isset($p['bestSingleTurn']) ? $p['bestSingleTurn'] : 0),
      'aiWins' => (int)(isset($p['aiWins']) ? $p['aiWins'] : 0),
      'aiLosses' => (int)(isset($p['aiLosses']) ? $p['aiLosses'] : 0),
      'aiGames' => (int)(isset($p['aiGames']) ? $p['aiGames'] : 0),
      'soloBestTurns' => isset($p['soloBestTurns']) && $p['soloBestTurns'] !== null ? (int)$p['soloBestTurns'] : null,
      'soloGames' => (int)(isset($p['soloGames']) ? $p['soloGames'] : 0),
      'farkles' => (int)(isset($p['farkles']) ? $p['farkles'] : 0),
      'farklePoints' => (int)(isset($p['farklePoints']) ? $p['farklePoints'] : 0),
      'attackBest' => (int)(isset($p['attackBest']) ? $p['attackBest'] : 0),
      'dailyDate' => isset($p['dailyDate']) ? (string)$p['dailyDate'] : '',
      'dailyScore' => (int)(isset($p['dailyScore']) ? $p['dailyScore'] : 0),
      'updated' => (int)(isset($p['updated']) ? $p['updated'] : 0)
    );
  }
  out(array('ok' => true, 'players' => $public));
}

if ($method !== 'POST') fail('method', 405);

$id = clean_id(isset($payload['clientId']) ? $payload['clientId'] : '');
$name = clean_name(isset($payload['name']) ? $payload['name'] : '');
if ($id === '') fail('client');
if (!valid_name($name)) fail('invalid-name');
$key = norm_key($name);

$fp = @fopen($FILE, 'c+');
if (!$fp) fail('storage', 500);
flock($fp, LOCK_EX);
$data = load_locked($fp);

// ---------- REGISTER ----------
if ($action === 'register') {
  if (isset($data['players'][$key])) {
    $owner = isset($data['players'][$key]['owner']) ? $data['players'][$key]['owner'] : '';
    if ($owner !== $id) { flock($fp, LOCK_UN); fclose($fp); fail('taken', 409); }
    $data['players'][$key]['name'] = $name;       // це ви — можна оновити написання
    $data['players'][$key]['updated'] = time();
  } else {
    if (count($data['players']) >= $MAX_PLAYERS) { flock($fp, LOCK_UN); fclose($fp); fail('full', 507); }
    $data['players'][$key] = new_player($name, $id);
  }
  save_locked($fp, $data);
  flock($fp, LOCK_UN); fclose($fp);
  out(array('ok' => true, 'name' => $name));
}

// ---------- SUBMIT ----------
if ($action === 'submit') {
  if (!isset($data['players'][$key])) {
    if (count($data['players']) >= $MAX_PLAYERS) { flock($fp, LOCK_UN); fclose($fp); fail('full', 507); }
    $data['players'][$key] = new_player($name, $id);
  }
  $owner = isset($data['players'][$key]['owner']) ? $data['players'][$key]['owner'] : '';
  if ($owner !== $id) { flock($fp, LOCK_UN); fclose($fp); fail('not-owner', 403); }

  $s = (isset($payload['stats']) && is_array($payload['stats'])) ? $payload['stats'] : array();
  $p = $data['players'][$key];

  // показники, що лише зростають — беремо максимум
  $p['bestSingleTurn'] = max((int)$p['bestSingleTurn'], clamp_int(isset($s['bestSingleTurn']) ? $s['bestSingleTurn'] : 0, 0, $CAP));
  $p['aiWins']      = max((int)$p['aiWins'],      clamp_int(isset($s['aiWins']) ? $s['aiWins'] : 0, 0, $CAP));
  $p['aiLosses']    = max((int)$p['aiLosses'],    clamp_int(isset($s['aiLosses']) ? $s['aiLosses'] : 0, 0, $CAP));
  $p['aiGames']     = max((int)$p['aiGames'],     clamp_int(isset($s['aiGames']) ? $s['aiGames'] : 0, 0, $CAP));
  $p['soloGames']   = max((int)$p['soloGames'],   clamp_int(isset($s['soloGames']) ? $s['soloGames'] : 0, 0, $CAP));
  $p['farkles']     = max((int)$p['farkles'],     clamp_int(isset($s['farkles']) ? $s['farkles'] : 0, 0, $CAP));
  $p['farklePoints']= max((int)$p['farklePoints'],clamp_int(isset($s['farklePoints']) ? $s['farklePoints'] : 0, 0, $CAP));
  $p['attackBest']  = max((int)(isset($p['attackBest']) ? $p['attackBest'] : 0),
                          clamp_int(isset($s['attackBest']) ? $s['attackBest'] : 0, 0, $CAP));

  // Щоденний виклик: результат прив'язаний до дати; новий день заміняє старий,
  // у межах одного дня зберігаємо найкращий результат.
  if (isset($s['dailyDate']) && preg_match('/^\d{4}-\d{2}-\d{2}$/', (string)$s['dailyDate'])
      && isset($s['dailyScore']) && (int)$s['dailyScore'] > 0) {
    $dDate = (string)$s['dailyDate'];
    $dScore = clamp_int($s['dailyScore'], 0, $CAP);
    $curDate = isset($p['dailyDate']) ? (string)$p['dailyDate'] : '';
    $curScore = (int)(isset($p['dailyScore']) ? $p['dailyScore'] : 0);
    if ($dDate > $curDate) {          // ISO-дати порівнюються як рядки
      $p['dailyDate'] = $dDate;
      $p['dailyScore'] = $dScore;
    } elseif ($dDate === $curDate) {
      $p['dailyScore'] = max($curScore, $dScore);
    }                                  // старіша дата — ігноруємо
  }

  // соло-ходи — рекорд-мінімум
  if (isset($s['soloBestTurns']) && (int)$s['soloBestTurns'] > 0) {
    $val = clamp_int($s['soloBestTurns'], 1, $CAP_TURNS);
    $cur = $p['soloBestTurns'];
    $p['soloBestTurns'] = ($cur === null) ? $val : min((int)$cur, $val);
  }
  $p['updated'] = time();
  $data['players'][$key] = $p;

  save_locked($fp, $data);
  flock($fp, LOCK_UN); fclose($fp);
  out(array('ok' => true));
}

flock($fp, LOCK_UN); fclose($fp);
fail('unknown-action');
