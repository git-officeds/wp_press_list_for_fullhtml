/**
 * wp-press-list-for-fullhtml-top
 * フルHTMLサイト向け WordPress REST API 投稿一覧コンポーネント
 */
(function (global) {
  'use strict';

  /**
   * デフォルト設定
   */
  var DEFAULT_CONFIG = {
    // 挿入先要素のセレクタまたはエレメント
    target: '#wp-press-list',
    // WordPress REST API エンドポイント (サーバールート直下の /wp)
    endpoint: '/wp/wp-json/wp/v2/posts',
    // 表示件数 (最新3件)
    maxPosts: 3,
    // アイキャッチサムネイル画像の表示・非表示 (デフォルト: true)
    showThumbnail: true,
    // アイキャッチ未設定時のデフォルト画像
    defaultThumbnail: '/images/default_thumb.jpg',
    // カテゴリ名の表示・非表示 (デフォルト: true)
    showCategory: true,
    // 本文抜粋文字数
    excerptLength: 80,
    // 「続きを読む」ボタンのテキスト
    readMoreText: '続きを読む',
    // 3件を超える場合に設置する投稿一覧ボタンのリンク先
    archiveUrl: '/press/',
    // 投稿一覧ボタンのテキスト
    archiveButtonText: '投稿一覧',
    // 読み込み中メッセージ
    loadingText: 'お知らせを読み込み中...',
    // 記事がない場合のメッセージ
    emptyText: '現在お知らせはありません。',
    // 取得失敗時のメッセージ
    errorText: 'お知らせの取得に失敗しました。'
  };

  /**
   * 日付を「YYYY年MM月DD日」形式にフォーマット
   * @param {string} dateString ISO形式等の日付文字列
   * @returns {string} フォーマット後の日付文字列
   */
  function formatDate(dateString) {
    if (!dateString) return '';
    var d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    var year = d.getFullYear();
    var month = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return year + '年' + month + '月' + day + '日';
  }

  /**
   * HTML文字列からタグを除去してプレーンテキストを抽出（実体参照も自動デコード）
   * @param {string} html HTML文字列
   * @returns {string} プレーンテキスト
   */
  function stripHtml(html) {
    if (!html) return '';
    try {
      var parser = new DOMParser();
      var doc = parser.parseFromString(html, 'text/html');
      // scriptやstyleタグのテキストを除去
      var scripts = doc.querySelectorAll('script, style');
      for (var i = 0; i < scripts.length; i++) {
        scripts[i].parentNode.removeChild(scripts[i]);
      }
      return (doc.body.textContent || '').trim();
    } catch (e) {
      // フォールバック: 正規表現による簡易タグ除去
      return html.replace(/<[^>]+>/g, '').trim();
    }
  }

  /**
   * HTMLエスケープ処理
   * @param {string} str 対象文字列
   * @returns {string} エスケープ後文字列
   */
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * 記事本文の抜粋と「続きを読む」判定処理
   * @param {string} contentHtml post.content.rendered
   * @param {number} maxLen 抜粋文字数
   * @returns {{ excerpt: string, hasMore: boolean }}
   */
  function processExcerpt(contentHtml, maxLen) {
    contentHtml = contentHtml || '';
    // 記事本文内に画像 (<img>タグ) が含まれているか判定
    var hasImage = /<img[^>]*>/i.test(contentHtml);

    // HTMLタグ・画像を除去してプレーンテキスト化
    var plain = stripHtml(contentHtml);
    var isOverMax = plain.length > maxLen;

    var excerpt = isOverMax ? plain.substring(0, maxLen) + '…' : plain;
    // 「記事内に画像が含まれる場合、または文字数が80文字を超える場合」
    var hasMore = hasImage || isOverMax;

    return {
      excerpt: excerpt,
      hasMore: hasMore
    };
  }

  /**
   * アイキャッチ画像URLの取得
   * @param {Object} post WordPress APIの投稿オブジェクト
   * @param {string} fallbackUrl 未設定時のデフォルト画像URL
   * @returns {string} 画像URL
   */
  function getThumbnailUrl(post, fallbackUrl) {
    try {
      if (
        post._embedded &&
        post._embedded['wp:featuredmedia'] &&
        post._embedded['wp:featuredmedia'][0] &&
        post._embedded['wp:featuredmedia'][0].source_url
      ) {
        var media = post._embedded['wp:featuredmedia'][0];
        // 中サイズ等があればそれを使用、なければ source_url
        if (
          media.media_details &&
          media.media_details.sizes &&
          media.media_details.sizes.medium &&
          media.media_details.sizes.medium.source_url
        ) {
          return media.media_details.sizes.medium.source_url;
        }
        return media.source_url;
      }
    } catch (e) {
      // 取得失敗時はfallbackへ
    }
    return fallbackUrl;
  }

  /**
   * カテゴリ名の取得
   * @param {Object} post WordPress APIの投稿オブジェクト
   * @returns {string} カテゴリ名
   */
  function getCategoryName(post) {
    try {
      if (
        post._embedded &&
        post._embedded['wp:term'] &&
        post._embedded['wp:term'][0] &&
        post._embedded['wp:term'][0].length > 0
      ) {
        // 先頭のカテゴリ名を取得
        return post._embedded['wp:term'][0][0].name || '';
      }
    } catch (e) {
      // 取得失敗時は空文字
    }
    return '';
  }

  /**
   * HTML要素の data-* 属性から設定値をマージ
   * @param {HTMLElement} el 対象要素
   * @param {Object} options 既存オプション
   * @returns {Object} マージ後オプション
   */
  function parseDataAttributes(el, options) {
    var opts = Object.assign({}, options);
    if (!el || !el.dataset) return opts;

    if (el.dataset.endpoint !== undefined) opts.endpoint = el.dataset.endpoint;
    if (el.dataset.showThumbnail !== undefined) {
      opts.showThumbnail = el.dataset.showThumbnail === 'true' || el.dataset.showThumbnail === '1';
    }
    if (el.dataset.defaultThumbnail !== undefined) opts.defaultThumbnail = el.dataset.defaultThumbnail;
    if (el.dataset.showCategory !== undefined) {
      opts.showCategory = el.dataset.showCategory === 'true' || el.dataset.showCategory === '1';
    }
    if (el.dataset.archiveUrl !== undefined) opts.archiveUrl = el.dataset.archiveUrl;
    if (el.dataset.archiveButtonText !== undefined) opts.archiveButtonText = el.dataset.archiveButtonText;
    if (el.dataset.readMoreText !== undefined) opts.readMoreText = el.dataset.readMoreText;
    if (el.dataset.excerptLength !== undefined) {
      var len = parseInt(el.dataset.excerptLength, 10);
      if (!isNaN(len)) opts.excerptLength = len;
    }
    return opts;
  }

  /**
   * 1つの記事アイテムのHTML文字列を生成
   * @param {Object} post 記事オブジェクト
   * @param {Object} opts 設定
   * @returns {string} HTML文字列
   */
  function renderItemHtml(post, opts) {
    var postUrl = (post.id !== undefined && post.id !== null) ? '/press/?p=' + encodeURIComponent(post.id) : (post.link || '#');
    var title = (post.title && post.title.rendered) ? post.title.rendered : '無題';
    var dateFormatted = formatDate(post.date);

    // 本文処理 (80文字抜粋 & 画像検出)
    var contentRaw = (post.content && post.content.rendered) ? post.content.rendered : '';
    var bodyResult = processExcerpt(contentRaw, opts.excerptLength);

    // 「続きを読む」リンクの有無
    var readMoreHtml = '';
    if (bodyResult.hasMore) {
      readMoreHtml = '<a href="' + escapeHtml(postUrl) + '" class="wppl-readmore-link">' +
        escapeHtml(opts.readMoreText) +
        '</a>';
    }

    // カテゴリ表示判定
    var categoryHtml = '';
    if (opts.showCategory) {
      var catName = getCategoryName(post);
      if (catName) {
        categoryHtml = '<span class="wppl-category">' + escapeHtml(catName) + '</span>';
      }
    }

    // サムネイル画像
    var thumbHtml = '';
    var itemClass = 'wppl-item';
    if (opts.showThumbnail) {
      var thumbUrl = getThumbnailUrl(post, opts.defaultThumbnail);
      thumbHtml =
        '<div class="wppl-thumb-col">' +
          '<a href="' + escapeHtml(postUrl) + '" class="wppl-thumb-box" style="background-image: url(\'' + escapeHtml(thumbUrl) + '\');" aria-label="' + escapeHtml(title) + 'のサムネイル">' +
          '</a>' +
        '</div>';
    } else {
      itemClass += ' wppl-no-thumb';
    }

    return (
      '<li class="' + itemClass + '">' +
        thumbHtml +
        '<div class="wppl-header-col">' +
          '<div class="wppl-meta">' +
            '<time class="wppl-date" datetime="' + escapeHtml(post.date) + '">' + escapeHtml(dateFormatted) + '</time>' +
            categoryHtml +
          '</div>' +
          '<h3 class="wppl-title">' +
            '<a href="' + escapeHtml(postUrl) + '" class="wppl-title-link">' + title + '</a>' +
          '</h3>' +
        '</div>' +
        '<div class="wppl-body-col">' +
          '<p class="wppl-excerpt">' +
            escapeHtml(bodyResult.excerpt) +
            readMoreHtml +
          '</p>' +
        '</div>' +
      '</li>'
    );
  }

  /**
   * メイン描画処理
   * @param {HTMLElement} container ターゲットコンテナ
   * @param {Object} opts 設定
   */
  function fetchAndRender(container, opts) {
    // ローディング表示
    container.innerHTML =
      '<div class="wppl-container">' +
        '<div class="wppl-loading">' +
          '<div class="wppl-loading-spinner"></div>' +
          '<div>' + escapeHtml(opts.loadingText) + '</div>' +
        '</div>' +
      '</div>';

    // 4件取得をリクエスト（最新3件の表示 + 4件目の存在有無で「投稿一覧」ボタンを判定）
    // _embed を付与することで featuredmedia や wp:term を1回のリクエストでまとめて取得
    var separator = opts.endpoint.indexOf('?') === -1 ? '?' : '&';
    var apiUrl = opts.endpoint + separator + '_embed=1&per_page=4&page=1';

    var totalPosts = null;

    fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    })
      .then(function (response) {
        if (!response.ok) {
          throw new Error('HTTP error ' + response.status);
        }
        // WordPress REST API ヘッダーから総記事数を取得
        var headerTotal = response.headers.get('X-WP-Total');
        if (headerTotal !== null) {
          totalPosts = parseInt(headerTotal, 10);
        }
        return response.json();
      })
      .then(function (posts) {
        if (!Array.isArray(posts) || posts.length === 0) {
          container.innerHTML =
            '<div class="wppl-container">' +
              '<div class="wppl-empty">' + escapeHtml(opts.emptyText) + '</div>' +
            '</div>';
          return;
        }

        // 表示件数は最新3件
        var displayPosts = posts.slice(0, opts.maxPosts);

        // 3件を超える記事があるか判定（X-WP-Totalヘッダー または 取得した配列長が4件以上）
        var hasMorePosts = false;
        if (totalPosts !== null) {
          hasMorePosts = totalPosts > opts.maxPosts;
        } else {
          hasMorePosts = posts.length > opts.maxPosts;
        }

        // 各記事のHTML生成
        var itemsHtml = displayPosts.map(function (post) {
          return renderItemHtml(post, opts);
        }).join('');

        // 投稿一覧ボタン (3件超ある場合のみ表示)
        var archiveAreaHtml = '';
        if (hasMorePosts) {
          archiveAreaHtml =
            '<div class="wppl-archive-area">' +
              '<a href="' + escapeHtml(opts.archiveUrl) + '" class="wppl-archive-btn">' +
                escapeHtml(opts.archiveButtonText) +
              '</a>' +
            '</div>';
        }

        // 組み立ててDOMに挿入
        container.innerHTML =
          '<div class="wppl-container">' +
            '<ul class="wppl-list">' +
              itemsHtml +
            '</ul>' +
            archiveAreaHtml +
          '</div>';
      })
      .catch(function (error) {
        console.error('[wp-press-list] 記事取得エラー:', error);
        container.innerHTML =
          '<div class="wppl-container">' +
            '<div class="wppl-error">' + escapeHtml(opts.errorText) + '</div>' +
          '</div>';
      });
  }

  /**
   * 初期化メソッド
   * @param {Object} userOptions ユーザー設定
   */
  function init(userOptions) {
    userOptions = userOptions || {};
    var target = userOptions.target || DEFAULT_CONFIG.target;
    var elements = [];

    if (typeof target === 'string') {
      elements = Array.prototype.slice.call(document.querySelectorAll(target));
    } else if (target instanceof HTMLElement) {
      elements = [target];
    } else if (target && target.length) {
      elements = Array.prototype.slice.call(target);
    }

    if (elements.length === 0) {
      return;
    }

    elements.forEach(function (el) {
      // 優先度: デフォルト値 < JSオプション < 要素のdata-*属性
      var mergedOptions = Object.assign({}, DEFAULT_CONFIG, userOptions);
      mergedOptions = parseDataAttributes(el, mergedOptions);
      fetchAndRender(el, mergedOptions);
    });
  }

  // グローバルオブジェクトに公開
  var WpPressList = {
    init: init,
    DEFAULT_CONFIG: DEFAULT_CONFIG
  };

  global.WpPressList = WpPressList;

  // DOMContentLoaded時の自動初期化 (data-wp-press-list または #wp-press-list がある場合)
  if (typeof document !== 'undefined') {
    var autoInit = function () {
      var autoElements = document.querySelectorAll('#wp-press-list, [data-wp-press-list]');
      if (autoElements.length > 0) {
        init({ target: autoElements });
      }
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', autoInit);
    } else {
      autoInit();
    }
  }

})(typeof window !== 'undefined' ? window : this);
