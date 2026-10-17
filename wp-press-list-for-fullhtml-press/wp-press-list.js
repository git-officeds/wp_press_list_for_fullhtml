/**
 * wp-press-list-for-fullhtml-press
 * フルHTMLサイト向け WordPress REST API 投稿一覧（ページネーション付き）コンポーネント
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
    // 1ページあたりの表示件数 (10件)
    perPage: 10,
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
    // 各ページリンク・ページネーションのベースURL（末尾にページ番号を付与）
    pageBaseUrl: '/press/?p=',
    // 読み込み中メッセージ
    loadingText: 'お知らせを読み込み中...',
    // 記事がない場合のメッセージ
    emptyText: '現在お知らせはありません。',
    // 取得失敗時のメッセージ
    errorText: 'お知らせの取得に失敗しました。'
  };

  /**
   * URLのクエリパラメータから指定キーの値を取得
   * @param {string} key パラメータ名
   * @returns {string|null}
   */
  function getQueryParam(key) {
    if (typeof window === 'undefined' || !window.location || !window.location.search) {
      return null;
    }
    try {
      var params = new URLSearchParams(window.location.search);
      return params.get(key);
    } catch (e) {
      var match = window.location.search.match(new RegExp('[?&]' + encodeURIComponent(key) + '=([^&]*)'));
      return match ? decodeURIComponent(match[1]) : null;
    }
  }

  /**
   * 現在のページ番号を取得
   * @returns {number} 1以上の整数
   */
  function getCurrentPage() {
    var p = getQueryParam('p');
    if (!p) return 1;
    var num = parseInt(p, 10);
    return !isNaN(num) && num > 0 ? num : 1;
  }

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
   * HTML文字列からタグを除去してプレーンテキストを抽出
   * @param {string} html HTML文字列
   * @returns {string} プレーンテキスト
   */
  function stripHtml(html) {
    if (!html) return '';
    try {
      var parser = new DOMParser();
      var doc = parser.parseFromString(html, 'text/html');
      var scripts = doc.querySelectorAll('script, style');
      for (var i = 0; i < scripts.length; i++) {
        scripts[i].parentNode.removeChild(scripts[i]);
      }
      return (doc.body.textContent || '').trim();
    } catch (e) {
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
    var hasImage = /<img[^>]*>/i.test(contentHtml);
    var plain = stripHtml(contentHtml);
    var isOverMax = plain.length > maxLen;
    var excerpt = isOverMax ? plain.substring(0, maxLen) + '…' : plain;
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
    if (el.dataset.readMoreText !== undefined) opts.readMoreText = el.dataset.readMoreText;
    if (el.dataset.pageBaseUrl !== undefined) opts.pageBaseUrl = el.dataset.pageBaseUrl;
    if (el.dataset.perPage !== undefined) {
      var pp = parseInt(el.dataset.perPage, 10);
      if (!isNaN(pp) && pp > 0) opts.perPage = pp;
    }
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
    // リンク先は「/press/?p=」で、末尾にページ番号（記事ID）を付与
    var postUrl = (post.id !== undefined && post.id !== null)
      ? opts.pageBaseUrl + encodeURIComponent(post.id)
      : (post.link || '#');

    var title = (post.title && post.title.rendered) ? post.title.rendered : '無題';
    var dateFormatted = formatDate(post.date);

    var contentRaw = (post.content && post.content.rendered) ? post.content.rendered : '';
    var bodyResult = processExcerpt(contentRaw, opts.excerptLength);

    var readMoreHtml = '';
    if (bodyResult.hasMore) {
      readMoreHtml = '<a href="' + escapeHtml(postUrl) + '" class="wppl-readmore-link">' +
        escapeHtml(opts.readMoreText) +
        '</a>';
    }

    var categoryHtml = '';
    if (opts.showCategory) {
      var catName = getCategoryName(post);
      if (catName) {
        categoryHtml = '<span class="wppl-category">' + escapeHtml(catName) + '</span>';
      }
    }

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
   * ページネーションHTMLを生成
   * @param {number} currentPage 現在のページ番号
   * @param {number} totalPages 総ページ数
   * @param {string} baseUrl ベースURL
   * @returns {string} HTML文字列
   */
  function renderPaginationHtml(currentPage, totalPages, baseUrl) {
    if (totalPages <= 1) return '';

    var html = '<nav class="wppl-pagination" aria-label="ページネーション"><ul class="wppl-pagination-list">';

    // 前へリンク
    if (currentPage > 1) {
      var prevPage = currentPage - 1;
      html += '<li class="wppl-pagination-item"><a href="' + escapeHtml(baseUrl + prevPage) + '" class="wppl-page-link wppl-page-prev" rel="prev">« 前へ</a></li>';
    }

    // 表示するページ番号の範囲を計算（現在ページの前後2ページ + 先頭 + 末尾）
    var pages = [];
    var delta = 2;
    var left = currentPage - delta;
    var right = currentPage + delta;

    for (var i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= left && i <= right)) {
        pages.push(i);
      }
    }

    var lastPageNumber = null;
    for (var j = 0; j < pages.length; j++) {
      var pageNum = pages[j];
      if (lastPageNumber !== null) {
        if (pageNum - lastPageNumber === 2) {
          // 差が2なら間の1ページを追加
          var middlePage = lastPageNumber + 1;
          html += '<li class="wppl-pagination-item"><a href="' + escapeHtml(baseUrl + middlePage) + '" class="wppl-page-link">' + middlePage + '</a></li>';
        } else if (pageNum - lastPageNumber > 2) {
          // 差が3以上なら省略記号「…」
          html += '<li class="wppl-pagination-item"><span class="wppl-page-ellipsis">…</span></li>';
        }
      }

      if (pageNum === currentPage) {
        html += '<li class="wppl-pagination-item"><span class="wppl-page-current" aria-current="page">' + pageNum + '</span></li>';
      } else {
        html += '<li class="wppl-pagination-item"><a href="' + escapeHtml(baseUrl + pageNum) + '" class="wppl-page-link">' + pageNum + '</a></li>';
      }
      lastPageNumber = pageNum;
    }

    // 次へリンク
    if (currentPage < totalPages) {
      var nextPage = currentPage + 1;
      html += '<li class="wppl-pagination-item"><a href="' + escapeHtml(baseUrl + nextPage) + '" class="wppl-page-link wppl-page-next" rel="next">次へ »</a></li>';
    }

    html += '</ul></nav>';
    return html;
  }

  /**
   * メイン描画処理
   * @param {HTMLElement} container ターゲットコンテナ
   * @param {Object} opts 設定
   */
  function fetchAndRender(container, opts) {
    var currentPage = getCurrentPage();

    // ローディング表示
    container.innerHTML =
      '<div class="wppl-container">' +
        '<div class="wppl-loading">' +
          '<div class="wppl-loading-spinner"></div>' +
          '<div>' + escapeHtml(opts.loadingText) + '</div>' +
        '</div>' +
      '</div>';

    var separator = opts.endpoint.indexOf('?') === -1 ? '?' : '&';
    var apiUrl = opts.endpoint + separator + '_embed=1&per_page=' + opts.perPage + '&page=' + currentPage;

    var totalPosts = 0;
    var totalPages = 1;

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
        var headerTotal = response.headers.get('X-WP-Total');
        var headerTotalPages = response.headers.get('X-WP-TotalPages');

        if (headerTotal !== null) {
          totalPosts = parseInt(headerTotal, 10);
        }
        if (headerTotalPages !== null) {
          totalPages = parseInt(headerTotalPages, 10);
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

        // 各記事のHTML生成
        var itemsHtml = posts.map(function (post) {
          return renderItemHtml(post, opts);
        }).join('');

        // 10件以上あればページネーションを表示（totalPages > 1 または totalPosts > opts.perPage）
        var paginationHtml = '';
        if (totalPages > 1 || totalPosts > opts.perPage) {
          // もしヘッダーからtotalPagesが取れず、記事が10件取得できている場合は最低2ページあると推測
          var effectiveTotalPages = totalPages > 1 ? totalPages : (totalPosts > 0 ? Math.ceil(totalPosts / opts.perPage) : (posts.length >= opts.perPage ? currentPage + 1 : currentPage));
          paginationHtml = renderPaginationHtml(currentPage, effectiveTotalPages, opts.pageBaseUrl);
        }

        // 組み立ててDOMに挿入
        container.innerHTML =
          '<div class="wppl-container">' +
            '<ul class="wppl-list">' +
              itemsHtml +
            '</ul>' +
            paginationHtml +
          '</div>';
      })
      .catch(function (error) {
        console.error('[wp-press-list-press] 記事取得エラー:', error);
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
      var mergedOptions = Object.assign({}, DEFAULT_CONFIG, userOptions);
      mergedOptions = parseDataAttributes(el, mergedOptions);
      fetchAndRender(el, mergedOptions);
    });
  }

  // グローバルオブジェクトに公開
  var WpPressListPress = {
    init: init,
    DEFAULT_CONFIG: DEFAULT_CONFIG
  };

  global.WpPressListPress = WpPressListPress;
  global.WpPressList = global.WpPressList || WpPressListPress;

  // DOMContentLoaded時の自動初期化
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
