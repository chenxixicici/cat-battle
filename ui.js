(function(){
  'use strict';
  
  window.UI = {
    assets: {},
  
    // ================= 九宫格切片比例 =================
    // 数值 = 切片占原图短边的比例（0~1）
    // 不用管图片实际像素，切片会按比例自动算
    // 如果某个素材拉伸后边缘变形，只需微调这个数值（比如从 0.20 调到 0.15）
    sliceRatio: {
      panel:      0.15,
      button:     0.20,
      frame:      0.30,
      banner:     0.35,
      bubble:     0.35,
      bar:        0.50,
      titleBar:   0.50,   // 紫条：切出完整左右圆角（半圆占高 50%）
      dialogBody: 0.15    // 深灰主体
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
        { key: 'bar_fill_green', src: 'images/ui/bar_fill_green.png' },
        { key: 'dialog_title',   src: 'images/ui/dialog_title.png' },
        { key: 'dialog_body',    src: 'images/ui/dialog_body.png' },
        { key: 'btn_close',      src: 'images/ui/btn_close.png' }
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
  
      // 源图切片尺寸（按图片短边比例）
      let sSrc = Math.round(Math.min(iw, ih) * ratio);
      sSrc = Math.min(sSrc, Math.floor(iw / 2) - 1, Math.floor(ih / 2) - 1);
      if(sSrc < 1) sSrc = 1;
  
      // 目标切片尺寸（按按钮短边比例，独立缩放）
      // ★ 目标切片上限 50%（紫条的圆角占高 50%，需要这个上限）
      let sDst = Math.round(Math.min(w, h) * ratio);
      sDst = Math.min(sDst, Math.floor(Math.min(w, h) * 0.50));
      if(sDst < 1) sDst = 1;
  
      // 1. 四角（源正方形 → 目标正方形，缩放映射）
      ctx.drawImage(img, 0, 0, sSrc, sSrc, x, y, sDst, sDst);
      ctx.drawImage(img, iw - sSrc, 0, sSrc, sSrc, x + w - sDst, y, sDst, sDst);
      ctx.drawImage(img, 0, ih - sSrc, sSrc, sSrc, x, y + h - sDst, sDst, sDst);
      ctx.drawImage(img, iw - sSrc, ih - sSrc, sSrc, sSrc, x + w - sDst, y + h - sDst, sDst, sDst);
  
      // 2. 上下边（横向拉伸）
      if(w - sDst * 2 > 0){
        ctx.drawImage(img, sSrc, 0, iw - sSrc * 2, sSrc, x + sDst, y, w - sDst * 2, sDst);
        ctx.drawImage(img, sSrc, ih - sSrc, iw - sSrc * 2, sSrc, x + sDst, y + h - sDst, w - sDst * 2, sDst);
      }
  
      // 3. 左右边（纵向拉伸）
      if(h - sDst * 2 > 0){
        ctx.drawImage(img, 0, sSrc, sSrc, ih - sSrc * 2, x, y + sDst, sDst, h - sDst * 2);
        ctx.drawImage(img, iw - sSrc, sSrc, sSrc, ih - sSrc * 2, x + w - sDst, y + sDst, sDst, h - sDst * 2);
      }
  
      // 4. 中心（双向拉伸）
      if(w - sDst * 2 > 0 && h - sDst * 2 > 0){
        ctx.drawImage(img, sSrc, sSrc, iw - sSrc * 2, ih - sSrc * 2,
                      x + sDst, y + sDst, w - sDst * 2, h - sDst * 2);
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
    },
        // ================= 通用组件：紫条标题 =================
        drawTitleBar(ctx, x, y, w, h, titleKey){
          const img = UI.assets[titleKey || 'dialog_title'];
          if(!img) return;
    
          const iw = img.width;
          const ih = img.height;
    
          // ★ 源图左右各取「短边 × 1.0」作为圆角段（胶囊素材，圆角横向占比较宽）
          // 对于 512×99 素材，sSrc = 99，左右各 99px，完整覆盖圆角
          let sSrc = Math.min(iw / 2 - 1, ih);
          if(sSrc < 1) sSrc = 1;
    
          // 目标左右段宽度：按高度等比缩放
          const sDst = sSrc * (h / ih);
    
          // 若左右两段之和超过总宽，退化为直接拉伸
          if(sDst * 2 >= w){
            ctx.drawImage(img, 0, 0, iw, ih, x, y, w, h);
            return;
          }
    
          // 1. 左段
          ctx.drawImage(img, 0, 0, sSrc, ih, x, y, sDst, h);
    
          // 2. 中段（横向拉伸）
          ctx.drawImage(img, sSrc, 0, iw - sSrc * 2, ih,
                        x + sDst, y, w - sDst * 2, h);
    
          // 3. 右段
          ctx.drawImage(img, iw - sSrc, 0, sSrc, ih,
                        x + w - sDst, y, sDst, h);
        },
    
        // ================= 通用组件：深灰弹窗主体 =================
        drawDialogBody(ctx, x, y, w, h, bodyKey){
          const img = UI.assets[bodyKey || 'dialog_body'];
          if(!img) return;
          UI.draw9Slice(ctx, img, x, y, w, h, UI.sliceRatio.dialogBody);
        }
  };
  
  })();