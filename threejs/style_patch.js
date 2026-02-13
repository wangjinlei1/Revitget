
(function () {
  const BIM_BG_COLOR = 0xffffff;

  function tryGet(obj, path) {
    let cur = obj;
    for (const key of path) {
      if (!cur) return null;
      try {
        cur = cur[key];
      } catch {
        return null;
      }
    }
    return cur ?? null;
  }

  function applyBimStyle() {
    const root = window.webView ?? window;
    const app = tryGet(root, ["app"]) || tryGet(root, ["webView", "app"]);
    if (!app) return false;

    const view = app.view || app.viewer;
    if (!view) return false;

    const scene = view.scene;
    const renderer = view.renderer;

    if (!scene || !renderer) return false;

    // 1. 背景调整为白色
    if (scene.background) {
      if (typeof scene.background.setHex === "function") {
        scene.background.setHex(BIM_BG_COLOR);
      } else {
        scene.background = null;
      }
    } else {
      scene.background = null;
    }

    if (typeof renderer.setClearColor === "function") {
      renderer.setClearColor(BIM_BG_COLOR, 1);
    }

    // 2. 遍历场景调整材质和灯光
    scene.traverse((obj) => {
      // 调整灯光：Revit 风格通常不需要太强的对比度，环境光要足
      if (obj.isLight) {
        if (obj.isAmbientLight) {
          // 提高环境光亮度，减少阴影死角
          obj.intensity = 1.5;
          obj.color.setHex(0xffffff);
        }
        if (obj.isDirectionalLight) {
          // 降低直射光强度，避免曝光过度
          obj.intensity = 0.8; 
        }
      }

      // 调整材质：Revit 默认着色模式通常是灰调，避免纯黑
      if (obj.isMesh && obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        
        mats.forEach(mat => {
          // 如果材质太黑，强制提亮
          if (mat.color) {
             const hsl = {};
             if (mat.color.getHSL) {
                mat.color.getHSL(hsl);
                // 如果亮度过低（接近黑色），提亮到灰色
                if (hsl.l < 0.15) {
                    mat.color.setHSL(hsl.h, hsl.s, 0.35); 
                }
             }
          }
          
          // 减少金属感和粗糙度，使其更像 Revit 的“着色”模式
          if (mat.metalness !== undefined) mat.metalness = 0.1;
          if (mat.roughness !== undefined) mat.roughness = 0.8;
          
          // 开启线框叠加（如果支持），模拟 Revit 的边缘显示
          // 注意：直接开启 wireframe 会变成纯线框，这里我们只做材质优化
          // 如果需要边缘线，通常需要 EdgesGeometry，这里暂不强行添加几何体，以免性能问题
        });
      }
      
      // 如果有线条（LineSegments），调整颜色为深灰而非纯黑，避免太刺眼
      if (obj.isLine || obj.isLineSegments) {
        if (obj.material && obj.material.color) {
           // 黑色线条改为深灰色 #333333
           if (obj.material.color.getHex() === 0x000000) {
              obj.material.color.setHex(0x333333);
           }
           // 稍微调细一点（如果支持）
           if (obj.material.linewidth) obj.material.linewidth = 1;
           obj.material.transparent = true;
           obj.material.opacity = 0.6; // 降低线条不透明度
        }
      }
    });

    return true;
  }

  // 持续检测以应对模型动态加载
  setInterval(() => {
    applyBimStyle();
  }, 800);
})();
