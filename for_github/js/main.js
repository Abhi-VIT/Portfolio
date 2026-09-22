// Simple UI enhancements: add a small fade-in on load
document.addEventListener('DOMContentLoaded', function(){
  document.querySelectorAll('.card').forEach(function(el, i){
    el.style.opacity = 0;
    el.style.transform = 'translateY(8px)';
    setTimeout(function(){
      el.style.transition = 'opacity 420ms ease, transform 420ms ease';
      el.style.opacity = 1;
      el.style.transform = 'translateY(0)';
    }, 80 * i);
  });
});
