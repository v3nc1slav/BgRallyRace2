<!DOCTYPE html>
<html lang="{{LANG}}">
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
  .box[hidden] { display: none; }
  h1 { margin: 0 0 8px; font-size: 1.5rem; color: #ff8a93; }
  .message { margin: 0 0 8px; font-size: 1.1rem; font-weight: 600; }
  .hint { margin: 0 0 16px; color: #9aa1ad; }
  button { padding: 10px 18px; font: inherit; font-weight: 600; color: #fff; background: #e63946; border: 0; border-radius: 6px; cursor: pointer; }
</style>
</head>
<body>
  <div class="box" lang="bg" data-title="BG Rally – {{TITLE_BG}}" {{HIDE_BG}}>
    <h1>{{HEADING_BG}}</h1>
    <p class="message">{{MESSAGE_BG}}</p>
    <p class="hint">{{HINT_BG}}</p>
    <button onclick="location.reload()">{{RETRY_BG}}</button>
  </div>
  <div class="box" lang="en" data-title="BG Rally – {{TITLE_EN}}" {{HIDE_EN}}>
    <h1>{{HEADING_EN}}</h1>
    <p class="message">{{MESSAGE_EN}}</p>
    <p class="hint">{{HINT_EN}}</p>
    <button onclick="location.reload()">{{RETRY_EN}}</button>
  </div>
  <script>
    (function () {
      var lang = null;
      try { lang = localStorage.getItem('bgr-lang'); } catch (e) { lang = null; }
      if (lang !== 'bg' && lang !== 'en') {
        var list = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || ''];
        lang = 'en';
        for (var i = 0; i < list.length; i++) {
          if (String(list[i]).toLowerCase().indexOf('bg') === 0) { lang = 'bg'; }
        }
        try { if (lang === 'en' && Intl.DateTimeFormat().resolvedOptions().timeZone === 'Europe/Sofia') { lang = 'bg'; } } catch (e) { lang = 'bg'; }
      }
      var boxes = document.querySelectorAll('.box[lang]');
      for (var j = 0; j < boxes.length; j++) {
        boxes[j].hidden = boxes[j].getAttribute('lang') !== lang;
        if (!boxes[j].hidden) { document.title = boxes[j].getAttribute('data-title'); }
      }
      document.documentElement.lang = lang;
    })();
  </script>
</body>
</html>
