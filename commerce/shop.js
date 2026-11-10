'use strict';
(function(){
 const $=id=>document.getElementById(id);
 const score=p=>p.demand*2+p.demo*2+p.marginPotential+p.shippingEase-p.risk-p.competition;
 const render=products=>{
   const category=$('category').value, sort=$('sort').value;
   let list=products.filter(p=>category==='All'||p.category===category);
   list.sort((a,b)=>sort==='business'?b.b2b-a.b2b:sort==='simple'?b.shippingEase-a.shippingEase:score(b)-score(a));
   $('count').textContent=list.length+' research candidates';
   const grid=$('grid');grid.replaceChildren();
   for(const p of list){
     const article=document.createElement('article');article.className='product';
     const visual=document.createElement('div');visual.className='product-visual';visual.textContent=p.icon;visual.setAttribute('aria-hidden','true');
     const body=document.createElement('div');body.className='product-content';
     const cat=document.createElement('span');cat.className='category';cat.textContent=p.category;
     const name=document.createElement('h3');name.textContent=p.name;
     const copy=document.createElement('p');copy.textContent=p.angle;
     const meta=document.createElement('div');meta.className='meta';
     const tag=document.createElement('span');tag.className='pill';tag.textContent='Research stage';
     const small=document.createElement('span');small.className='rating';small.textContent='Research priority: '+score(p);
     meta.append(tag,small);body.append(cat,name,copy,meta);article.append(visual,body);grid.append(article);
   }
 };
 fetch('/commerce/catalog.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('Catalog unavailable');return r.json()}).then(data=>{const items=data.products.filter(p=>p.status==='research'&&!p.supplierVerified&&!p.checkoutUrl);render(items);$('category').addEventListener('change',()=>render(items));$('sort').addEventListener('change',()=>render(items))}).catch(()=>{$('grid').textContent='Product preview unavailable. Please check back soon.'});
})();
