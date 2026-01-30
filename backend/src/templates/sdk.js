(function(){'use strict';
var C={apiBase:'{{API_BASE_URL}}',sKey:'ft_visitor_id',qKey:'ft_response_queue',maxQ:10};
var M={};
var S={
  get:function(k){try{var v=localStorage.getItem(k);return v!==null?v:M[k]}catch(e){return M[k]}},
  set:function(k,v){try{localStorage.setItem(k,v)}catch(e){M[k]=v}},
  getJ:function(k){try{var v=this.get(k);return v?JSON.parse(v):null}catch(e){return null}},
  setJ:function(k,v){try{this.set(k,JSON.stringify(v))}catch(e){M[k]=v}}
};
function uuid(){return'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,function(c){var r=Math.random()*16|0;return(c==='x'?r:(r&0x3|0x8)).toString(16)})}
function jwt(t){try{var p=t.split('.');if(p.length!==3)return null;return JSON.parse(atob(p[1].replace(/-/g,'+').replace(/_/g,'/')))}catch(e){return null}}
function param(n){try{return new URLSearchParams(location.search).get(n)}catch(e){return null}}
function clean(o){var s=new WeakSet();return JSON.parse(JSON.stringify(o,function(k,v){if(typeof v==='object'&&v!==null){if(s.has(v))return;s.add(v)}return v}))}
var F={
  _init:false,_ctx:null,_id:null,
  _slug:function(){
    try{var m=document.querySelector('meta[name="ft-tool-slug"]');if(m&&m.content)return m.content}catch(e){}
    try{var x=location.pathname.match(/\/tools\/([^/]+)/);if(x&&x[1])return x[1]}catch(e){}
    try{var s=document.body.getAttribute('data-tool-slug');if(s)return s}catch(e){}
    return null
  },
  _capture:function(){
    try{
      var id={visitorId:S.get(C.sKey),source:'direct'};
      if(!id.visitorId){id.visitorId=uuid();S.set(C.sKey,id.visitorId)}
      var t=param('ft_token');
      if(t){var c=jwt(t);if(c){id.lwId=c.user_id||c.sub;id.name=c.user_name||c.name;id.email=c.user_email||c.email;id.course=c.course_id;id.lesson=c.lesson_id}}
      if(!id.lwId)id.lwId=param('user_id')||param('lw_user_id');
      if(!id.name)id.name=param('user_name')||param('name');
      if(!id.email)id.email=param('user_email')||param('email');
      if(!id.course)id.course=param('course_id');
      if(!id.lesson)id.lesson=param('lesson_id');
      id.ref=document.referrer||null;
      if(id.lwId||(id.ref&&id.ref.indexOf('learnworlds')!==-1))id.source='learnworlds';
      else if(window!==window.top)id.source='embed';
      else if(param('share')||(id.ref&&/facebook|twitter|linkedin|whatsapp/i.test(id.ref)))id.source='share';
      return id
    }catch(e){console.warn('[FT] Identity error');return{visitorId:uuid(),source:'direct'}}
  },
  _queue:function(p,s){
    try{var q=S.getJ(C.qKey)||[];q.push({p:p,t:Date.now(),s:s});while(q.length>C.maxQ)q.shift();S.setJ(C.qKey,q);return true}catch(e){return false}
  },
  _flush:function(){
    try{
      var q=S.getJ(C.qKey)||[];if(!q.length)return;
      console.log('[FT] Flushing',q.length,'queued');
      var nq=[];
      Promise.all(q.map(function(i){
        return fetch(C.apiBase+'/api/tools/'+i.s+'/responses',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(i.p)})
          .then(function(r){if(!r.ok)nq.push(i)}).catch(function(){nq.push(i)})
      })).then(function(){S.setJ(C.qKey,nq)})
    }catch(e){}
  },
  init:function(o){
    try{
      o=o||{};
      this._ctx={slug:o.slug||this._slug(),ver:o.version||'1.0.0',api:o.apiBase||C.apiBase};
      this._id=this._capture();this._init=true;this._flush();
      console.log('[FT] Init:',this._ctx.slug||'(none)','|',this._id.visitorId);
      return this
    }catch(e){console.warn('[FT] Init failed');this._init=false;return this}
  },
  submit:function(inp,res,o){
    var self=this;o=o||{};
    return new Promise(function(resolve){
      try{
        if(!self._ctx||!self._ctx.slug){
          console.error('[FT] No slug');if(o.onError)o.onError(new Error('No slug'));
          return resolve({success:false,error:'No slug',queued:false})
        }
        var p={
          visitorId:self._id.visitorId,userName:self._id.name,userEmail:self._id.email,
          learnworldsUserId:self._id.lwId,inputs:clean(inp),result:clean(res),
          source:self._id.source,courseId:self._id.course,lessonId:self._id.lesson,
          referrer:self._id.ref,toolVersion:self._ctx.ver
        };
        fetch(self._ctx.api+'/api/tools/'+self._ctx.slug+'/responses',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(p)})
          .then(function(r){
            if(r.ok)return r.json().then(function(d){
              console.log('[FT] Submitted:',d.id);if(o.onSuccess)o.onSuccess({id:d.id,visitorId:self._id.visitorId});
              resolve({success:true,responseId:d.id})
            });
            throw new Error('API '+r.status)
          })
          .catch(function(e){
            console.warn('[FT] Submit failed');var q=self._queue(p,self._ctx.slug);
            if(o.onError)o.onError(e);resolve({success:false,error:e.message,queued:q})
          })
      }catch(e){console.warn('[FT] Submit error');if(o.onError)o.onError(e);resolve({success:false,error:e.message,queued:false})}
    })
  },
  getVisitor:function(){
    try{return{visitorId:this._id.visitorId,source:this._id.source,userName:this._id.name,userEmail:this._id.email,learnworldsUserId:this._id.lwId,courseId:this._id.course,lessonId:this._id.lesson,referrer:this._id.ref}}
    catch(e){return{visitorId:uuid(),source:'direct'}}
  }
};
function auto(){if(!F._init)F.init()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',auto);else auto();
window.FastTrackTool=F;
})();
