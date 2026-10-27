// Measure before first paint and again when mobile browser chrome settles. The CSS
// dvh/svh declarations still cover loading and engines without visualViewport.
(function(){
  let frame=0,settle=0;
  function sync(){
    const vv=window.visualViewport;
    const height=vv&&Math.abs(vv.scale-1)<.01?vv.height:window.innerHeight;
    if(height>0)document.documentElement.style.setProperty('--vh',(height*.01)+'px');
  }
  function schedule(){sync();cancelAnimationFrame(frame);frame=requestAnimationFrame(sync);}
  sync();
  window.addEventListener('resize',schedule);
  window.addEventListener('pageshow',schedule);
  window.addEventListener('orientationchange',()=>{schedule();clearTimeout(settle);settle=setTimeout(schedule,250);});
  if(window.visualViewport)window.visualViewport.addEventListener('resize',schedule);
})();
