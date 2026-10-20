<!DOCTYPE html>
<html lang="bg">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<meta name="theme-color" content="#15171c">
<title>BG Rally – {{TITLE}}</title>
<style>
  html, body { height: 100%; margin: 0; }
  body {
    display: flex; align-items: flex-end; justify-content: center; box-sizing: border-box; padding: 24px 16px;
    font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; color: #e9ebef;
    background: #15171c url('{{IMAGE}}') center / cover no-repeat;
  }
  .box { width: min(560px, 100%); padding: 24px; text-align: center; background: rgba(21, 23, 28, 0.88); border: 1px solid #2e333d; border-radius: 8px; }
  h1 { margin: 0 0 8px; font-size: 1.5rem; color: #ff8a93; }
  .message { margin: 0 0 8px; font-size: 1.1rem; font-weight: 600; }
  .hint { margin: 0 0 16px; color: #9aa1ad; }
  button { padding: 10px 18px; font: inherit; font-weight: 600; color: #fff; background: #e63946; border: 0; border-radius: 6px; cursor: pointer; }
</style>
</head>
<body>
  <div class="box">
    <h1>Излязохме от пътя</h1>
    <p class="message">{{MESSAGE}}</p>
    <p class="hint">{{HINT}}</p>
    <button onclick="location.reload()">Опитай отново</button>
  </div>
</body>
</html>
