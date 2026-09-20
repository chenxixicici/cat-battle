(function(){
  'use strict';
  
  window.UI = {
    assets: {},
  
    // ================= 九宫格切片比例 =================
    // 数值 = 切片占原图短边的比例（0~1）
    // 不用管图片实际像素，切片会按比例自动算
    // 如果某个素材拉伸后边缘变形，只需微调这个数值（比如从 0.20 调到 0.15）
    sliceRatio: {
      panel:  0.10,   // 深蓝面板，四角装饰较小
      button: 0.22,   // 按钮，圆角 + 顶部高光 + 底部厚度
      frame:  0.20,   // 方形底框
      banner: 0.15,   // 横幅，两侧燕尾
      bubble: 0.15,   // 对话气泡
      bar:    0.50    // 血条，胶囊形，切片取一半
    },
  
    // ================= 图片预加载 =================
    loadAll(onDone){
      const list = [
        { key: 'panel_bg',   src: 'images/ui/panel_bg.png' },
        { key: 'banner_main', src: 'images/ui/banner_main.png' },
        { key: 'banner_sub',  src: 'images/ui/banner_sub.png' },
        { key: 'bubble',     src: 'images/ui/bubble.png' },
        { key: 'btn_yellow', src: 'images/ui/btn_yellow.png' },
        { key: 'btn_blue',   src: 'images/ui/btn_blue.png' },
        { key: 'btn_red',    src: 'images/ui/btn_red.png' },
        { key: 'btn_green',  src: 'images/ui/btn_green.png' },
        { key: 'frame_blue',   src: 'images/ui/frame_blue.png' },
        { key: 'frame_purple', src: 'images/ui/frame_purple.png' },
        { key: 'frame_red',    src: 'images/ui/frame_red.png' },
        { key: 'skill_frame',  src: 'images/ui/skill_frame.png' },
        { key: 'icon_pause',   src: 'images/ui/icon_pause.png' },
        { key: 'icon_menu',    src: 'images/ui/icon_menu.png' },
        { key: 'icon_arrow',   src: 'images/ui/icon_arrow.png' },
        { key: 'icon_close',   src: 'images/ui/icon_close.png' },
        { key: 'icon_settings',src: 'images/ui/icon_settings.png' },
        { key: 'icon_coin',    src: 'images/ui/icon_coin.png' },
        { key: 'icon_diamond', src: 'images/ui/icon_diamond.png' },
        { key: 'icon_star',    src: 'images/ui/icon_star.png' },
        { key: 'icon_skill_laser', src: 'images/ui/icon_skill_laser.png' },
        { key: 'bar_track',      src: 'images/ui/bar_track.png' },
        { key: 'bar_fill_green', src: 'images/ui/bar_fill_green.png' }
      ];
  
      let loaded = 0;
      const total = list.length;
      if(total === 0 && onDone){ onDone(); return; }
  
      for(const item of list){
        const img = new Image();
        img.onload = () => {
          UI.assets[item.key] = img;
          loaded++;
          if(loaded >= total && onDone) onDone();
        };
        img.onerror = () => {
          console.warn('UI素材加载失败:', item.src);
          loaded++;
          if(loaded >= total && onDone) onDone();
        };
        img.src = item.src;
      }
    },
  
    // ================= 九宫格核心渲染 =================
    // 自动根据原图尺寸 + 比例 切出 9 块，拉伸绘制
    draw9Slice(ctx, img, x, y, w, h, ratio){
      if(!img) return;
  
      const iw = img.width;
      const ih = img.height;
  
      // 切片像素：取宽高里较小的那个，乘以比例，得到正方形切片
      // 这样无论原图是 1024x1024 还是 400x150，切片都是正方形的
      let s = Math.round(Math.min(iw, ih) * ratio);
  
      // 保险：切片不能超过图片的一半
      s = Math.min(s, Math.floor(iw / 2) - 1, Math.floor(ih / 2) - 1);
      if(s < 1) s = 1;
  
      // 1. 四角（不拉伸）
      ctx.drawImage(img, 0, 0, s, s, x, y, s, s);
      ctx.drawImage(img, iw - s, 0, s, s, x + w - s, y, s, s);
      ctx.drawImage(img, 0, ih - s, s, s, x, y + h - s, s, s);
      ctx.drawImage(img, iw - s, ih - s, s, s, x + w - s, y + h - s, s, s);
  
      // 2. 上下边（横向拉伸）
      if(w - s * 2 > 0){
        ctx.drawImage(img, s, 0, iw - s * 2, s, x + s, y, w - s * 2, s);
        ctx.drawImage(img, s, ih - s, iw - s * 2, s, x + s, y + h - s, w - s * 2, s);
      }
  
      // 3. 左右边（纵向拉伸）
      if(h - s * 2 > 0){
        ctx.drawImage(img, 0, s, s, ih - s * 2, x, y + s, s, h - s * 2);
        ctx.drawImage(img, iw - s, s, s, ih - s * 2, x + w - s, y + s, s, h - s * 2);
      }
  
      // 4. 中心（双向拉伸）
      if(w - s * 2 > 0 && h - s * 2 > 0){
        ctx.drawImage(img, s, s, iw - s * 2, ih - s * 2,
                      x + s, y + s, w - s * 2, h - s * 2);
      }
    },
  
    // ================= 通用组件：面板 =================
    drawPanel(ctx, x, y, w, h, panelKey){
      const img = UI.assets[panelKey || 'panel_bg'];
      if(!img) return;
      UI.draw9Slice(ctx, img, x, y, w, h, UI.sliceRatio.panel);
    },
  
    // ================= 通用组件：横幅 =================
    drawBanner(ctx, x, y, w, h, text, bannerKey, textSize){
      const img = UI.assets[bannerKey || 'banner_main'];
      if(!img) return;
      UI.draw9Slice(ctx, img, x, y, w, h, UI.sliceRatio.banner);
  
      if(text){
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = 'bold ' + (textSize || 26) + 'px "Microsoft YaHei", sans-serif';
        ctx.lineWidth = 4;
        ctx.strokeStyle = 'rgba(0,0,0,0.85)';
        ctx.strokeText(text, x + w / 2, y + h / 2);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(text, x + w / 2, y + h / 2);
        ctx.restore();
      }
    },
  
    // ================= 通用组件：按钮 =================
    drawButton(ctx, x, y, w, h, text, btnKey, textSize){
      const img = UI.assets[btnKey || 'btn_yellow'];
      if(!img) return;
      UI.draw9Slice(ctx, img, x, y, w, h, UI.sliceRatio.button);
  
      if(text){
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = 'bold ' + (textSize || 24) + 'px "Microsoft YaHei", sans-serif';
        ctx.lineWidth = 4;
        ctx.strokeStyle = 'rgba(0,0,0,0.85)';
        ctx.strokeText(text, x + w / 2, y + h / 2);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(text, x + w / 2, y + h / 2);
        ctx.restore();
      }
    },
  
    // ================= 通用组件：图标底框 =================
    drawFrame(ctx, x, y, w, h, frameKey){
      const img = UI.assets[frameKey || 'frame_blue'];
      if(!img) return;
      UI.draw9Slice(ctx, img, x, y, w, h, UI.sliceRatio.frame);
    },
  
    // ================= 通用组件：图标 =================
    drawIcon(ctx, key, x, y, size){
      const img = UI.assets[key];
      if(!img) return;
      ctx.drawImage(img, x, y, size, size);
    },
  
    // ================= 通用组件：对话气泡 =================
    // 注意：气泡带尾巴，切片九宫格会拉伸尾巴，所以推荐用固定尺寸
    drawBubble(ctx, x, y, w, h, bubbleKey){
      const img = UI.assets[bubbleKey || 'bubble'];
      if(!img) return;
      UI.draw9Slice(ctx, img, x, y, w, h, UI.sliceRatio.bubble);
    },
  
    // ================= 通用组件：血条 / 进度条 =================
    drawBar(ctx, x, y, w, h, ratio, fillKey){
      const track = UI.assets['bar_track'];
      if(!track) return;
  
      // 底框
      UI.draw9Slice(ctx, track, x, y, w, h, UI.sliceRatio.bar);
  
      // 填充
      const fill = UI.assets[fillKey || 'bar_fill_green'];
      if(fill && ratio > 0){
        ctx.save();
        const r = h / 2;
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
        ctx.clip();
  
        UI.draw9Slice(ctx, fill, x, y, w * Math.min(1, ratio), h, UI.sliceRatio.bar);
        ctx.restore();
      }
    }
  };
  
  })();