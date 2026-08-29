/* 新加坡采购学堂 · 全站交互脚本 */
(function () {
  'use strict';

  var STORE_KEY = 'sgproc-done-modules';

  function getDone() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  }

  function setDone(list) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(list)); } catch (e) { /* 忽略 */ }
  }

  /* ---------- 导航高亮 + 移动端菜单 ---------- */

  function initNav() {
    var page = location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.site-nav a').forEach(function (a) {
      var href = a.getAttribute('href');
      if (href === page) a.classList.add('active');
    });

    var toggle = document.querySelector('.nav-toggle');
    var nav = document.querySelector('.site-nav');
    if (toggle && nav) {
      toggle.addEventListener('click', function () {
        var open = nav.classList.toggle('open');
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
    }
  }

  /* ---------- 「标记为已学」 ---------- */

  function renderDoneButton(btn) {
    var mod = btn.getAttribute('data-module');
    var done = getDone().indexOf(mod) !== -1;
    btn.classList.toggle('done', done);
    btn.textContent = done ? '✓ 已学完本章' : '○ 标记本章为已学';
  }

  function initDoneButtons() {
    document.querySelectorAll('.btn-done[data-module]').forEach(function (btn) {
      renderDoneButton(btn);
      btn.addEventListener('click', function () {
        var mod = btn.getAttribute('data-module');
        var list = getDone();
        var i = list.indexOf(mod);
        if (i === -1) list.push(mod); else list.splice(i, 1);
        setDone(list);
        renderDoneButton(btn);
      });
    });
  }

  function initModuleCards() {
    var done = getDone();
    document.querySelectorAll('[data-module-card]').forEach(function (card) {
      if (done.indexOf(card.getAttribute('data-module-card')) !== -1) {
        card.classList.add('done');
      }
    });
    var counter = document.getElementById('progress-count');
    if (counter) {
      var total = document.querySelectorAll('[data-module-card]').length;
      counter.textContent = done.filter(function (m) {
        return document.querySelector('[data-module-card="' + m + '"]');
      }).length + ' / ' + total;
    }
  }

  /* ---------- 测验引擎（仅 quiz.html） ---------- */

  function initQuiz() {
    var app = document.getElementById('quiz-app');
    var dataEl = document.getElementById('quiz-data');
    if (!app || !dataEl) return;

    var questions;
    try { questions = JSON.parse(dataEl.textContent); } catch (e) { return; }
    if (!Array.isArray(questions) || !questions.length) return;

    var modules = [];
    questions.forEach(function (q) {
      if (!modules.some(function (m) { return m.key === q.module; })) {
        modules.push({ key: q.module, label: q.moduleLabel });
      }
    });

    var state = { filter: 'all', answered: {}, correct: {} };
    var params = new URLSearchParams(location.search);
    var pre = params.get('module');
    if (pre && modules.some(function (m) { return m.key === pre; })) state.filter = pre;

    var filterBox = document.createElement('div');
    filterBox.className = 'quiz-filters';
    app.appendChild(filterBox);

    var scoreBox = document.createElement('div');
    scoreBox.className = 'quiz-score';
    scoreBox.innerHTML = '<span class="score-text"></span><div class="bar"><i></i></div>' +
      '<button class="btn" type="button" id="quiz-reset">重新开始</button>';
    app.appendChild(scoreBox);

    var listBox = document.createElement('div');
    listBox.id = 'quiz-list';
    app.appendChild(listBox);

    scoreBox.querySelector('#quiz-reset').addEventListener('click', function () {
      state.answered = {}; state.correct = {};
      renderList(); updateScore();
    });

    function visibleQuestions() {
      return questions.filter(function (q) {
        return state.filter === 'all' || q.module === state.filter;
      });
    }

    function renderFilters() {
      filterBox.innerHTML = '';
      var all = [{ key: 'all', label: '全部 (' + questions.length + ')' }].concat(
        modules.map(function (m) {
          var n = questions.filter(function (q) { return q.module === m.key; }).length;
          return { key: m.key, label: m.label + ' (' + n + ')' };
        })
      );
      all.forEach(function (f) {
        var chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'chip' + (state.filter === f.key ? ' active' : '');
        chip.textContent = f.label;
        chip.addEventListener('click', function () {
          state.filter = f.key;
          renderFilters(); renderList(); updateScore();
        });
        filterBox.appendChild(chip);
      });
    }

    function updateScore() {
      var vis = visibleQuestions();
      var answered = 0, correct = 0;
      vis.forEach(function (q) {
        if (state.answered[q.id]) {
          answered++;
          if (state.correct[q.id]) correct++;
        }
      });
      scoreBox.querySelector('.score-text').textContent =
        '已答 ' + answered + ' / ' + vis.length + ' 题，答对 ' + correct + ' 题';
      scoreBox.querySelector('.bar i').style.width =
        (vis.length ? Math.round(answered / vis.length * 100) : 0) + '%';
      scoreBox.querySelector('.bar i').style.background =
        answered && correct / Math.max(answered, 1) >= 0.6 ? 'var(--ok)' : 'var(--accent)';
    }

    function renderList() {
      listBox.innerHTML = '';
      visibleQuestions().forEach(function (q, idx) {
        var box = document.createElement('div');
        box.className = 'quiz-q' + (state.answered[q.id] ? ' answered' : '');

        var meta = document.createElement('p');
        meta.className = 'q-meta';
        meta.textContent = '第 ' + (idx + 1) + ' 题 · ' + q.moduleLabel;
        box.appendChild(meta);

        var text = document.createElement('p');
        text.className = 'q-text';
        text.textContent = q.question;
        box.appendChild(text);

        var opts = document.createElement('div');
        opts.className = 'opts';
        q.options.forEach(function (opt, oi) {
          var b = document.createElement('button');
          b.type = 'button';
          b.className = 'opt';
          b.textContent = String.fromCharCode(65 + oi) + '. ' + opt;
          if (state.answered[q.id]) {
            b.disabled = true;
            if (oi === q.answer) b.classList.add('correct');
            else if (oi === state.answered[q.id] - 1 && !state.correct[q.id]) b.classList.add('wrong');
          } else {
            b.addEventListener('click', function () {
              state.answered[q.id] = oi + 1;
              state.correct[q.id] = (oi === q.answer);
              renderList(); updateScore();
              });
          }
          opts.appendChild(b);
        });
        box.appendChild(opts);

        var ex = document.createElement('div');
        ex.className = 'explain';
        ex.textContent = (state.correct[q.id] ? '✅ 回答正确！' : '❌ 回答错误。') + ' ' + q.explanation;
        box.appendChild(ex);

        listBox.appendChild(box);
      });
    }

    renderFilters(); renderList(); updateScore();
  }

  document.addEventListener('DOMContentLoaded', function () {
    initNav();
    initDoneButtons();
    initModuleCards();
    initQuiz();
  });
})();
