(() => {
  'use strict';
  const $ = sel => document.querySelector(sel);
  const config = window.SCOUT_CLOUD_CONFIG || {};
  const enabled = /^https:\/\/[a-z0-9.-]+$/i.test(config.url || '') && Boolean(config.publishableKey) && Boolean(window.supabase?.createClient);
  const client = enabled ? window.supabase.createClient(config.url, config.publishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  }) : null;
  let user = null, saving = false, pending = false, timer = null, sessionGeneration = 0;
  let hydrated = false;

  const setFeedback = message => { $('#cloudFeedback').textContent = message || ''; };
  const object = v => v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  const clean = raw => {
    const d = object(raw);
    return { saved: Array.isArray(d.saved) ? [...new Set(d.saved.filter(x => typeof x === 'string'))] : [],
      tracking: object(d.tracking), notes: object(d.notes),
      custom: Array.isArray(d.custom) ? d.custom.filter(x => x && typeof x.id === 'string') : [],
      _revisions: object(d._revisions) };
  };
  const has = (o,k) => Object.prototype.hasOwnProperty.call(o,k);
  // A revision also acts as a tombstone: un-saving or deleting an item is retained.
  function mergeProgress(localRaw, remoteRaw) {
    const a=clean(localRaw), b=clean(remoteRaw), ar=a._revisions, br=b._revisions;
    const out={saved:[],tracking:{},notes:{},custom:[],_revisions:{}};
    const allRevisions = new Set([...Object.keys(ar), ...Object.keys(br)]);
    allRevisions.forEach(key => out._revisions[key] = Math.max(Number(ar[key]) || 0, Number(br[key]) || 0));
    const sourceFor = (key, aa, bb) => {
      const at=Number(ar[key])||0, bt=Number(br[key])||0;
      if(at>bt)return aa?'a':null;
      if(bt>at)return bb?'b':null;
      if(bb)return 'b';
      if(aa)return 'a';
      return null;
    };
    const allSaved = new Set([...a.saved,...b.saved,...[...allRevisions].filter(x=>x.startsWith('saved:')).map(x=>x.slice(6))]);
    allSaved.forEach(id=>{
      const chosen=sourceFor('saved:'+id,a.saved.includes(id),b.saved.includes(id));
      if(chosen)out.saved.push(id);
    });
    for(const field of ['tracking','notes']){
      const ids=new Set([...Object.keys(a[field]),...Object.keys(b[field]),...[...allRevisions].filter(x=>x.startsWith(field+':')).map(x=>x.slice(field.length+1))]);
      ids.forEach(id=>{
        const side=sourceFor(field+':'+id,has(a[field],id),has(b[field],id));
        if(side)out[field][id]=side==='a'?a[field][id]:b[field][id];
      });
    }
    const ac=new Map(a.custom.map(j=>[j.id,j])),bc=new Map(b.custom.map(j=>[j.id,j]));
    const ids=new Set([...ac.keys(),...bc.keys(),...[...allRevisions].filter(x=>x.startsWith('custom:')).map(x=>x.slice(7))]);
    ids.forEach(id=>{
      const side=sourceFor('custom:'+id,ac.has(id),bc.has(id));
      if(side)out.custom.push(side==='a'?ac.get(id):bc.get(id));
    });
    return out;
  }
  const renderAccount = () => {
    $('#cloudEmailForm').hidden = !enabled || Boolean(user);
    $('#cloudSignedIn').hidden = !enabled || !user;
    $('#cloudSetupNote').hidden = enabled && Boolean(user);
    $('#cloudUserEmail').textContent = user?.email || '';
    $('#accountBtn').textContent = user ? '☁ Progress synced' : '☁ Save progress';
    $('#accountMessage').textContent = user
      ? (hydrated ? 'Your saved roles, applications and notes are privately backed up and available on other devices using the same email.' : 'Loading your private application progress…')
      : enabled ? 'Progress is saved in this browser. Sign in with email to keep it across devices.'
        : 'Progress is saved in this browser. Cross-device sync will become available once the site owner configures Supabase.';
    if(!enabled) $('#cloudSetupNote').textContent = 'Cloud syncing is not activated yet. You can still save on this browser and export CSV backups.';
    else $('#cloudSetupNote').textContent = 'Use the same email address on your phone or laptop to restore your saved applications.';
  };
  const bridge = () => window.ScoutBridge;
  async function flush(force=false) {
    if(!enabled || !client || !user || !hydrated) return false;
    if(saving){pending=true;return false;}
    if(!force && !pending)return true;
    saving=true;pending=false;
    const uid=user.id, gen=sessionGeneration;
    try{
      const result=await client.from('scout_user_progress').select('payload').eq('user_id',uid).maybeSingle();
      if(result.error)throw result.error;
      if(uid!==user?.id || gen!==sessionGeneration)return false;
      const merged=mergeProgress(bridge().getProgress(),result.data?.payload||{});
      bridge().setProgress(merged);
      const saved=await client.from('scout_user_progress').upsert({user_id:uid,payload:merged,updated_at:new Date().toISOString()},{onConflict:'user_id'});
      if(saved.error)throw saved.error;
      if(uid!==user?.id || gen!==sessionGeneration)return false;
      setFeedback('Saved privately to your account.');
      return true;
    }catch(e){
      setFeedback('Cloud sync failed: '+(e?.message||'Unknown error')+'. Your browser copy is still saved.');
      return false;
    }finally{
      saving=false;
      if(pending && user && hydrated) scheduleSync();
    }
  }
  function scheduleSync() {
    if(!user || !hydrated) return;
    pending=true; clearTimeout(timer);
    timer=setTimeout(()=>{void flush();},850);
  }
  async function handleSession(session) {
    const next=session?.user||null;
    if(next?.id===user?.id && hydrated)return;
    sessionGeneration++;
    user=next;hydrated=false; clearTimeout(timer); pending=false;
    renderAccount();
    if(!user)return;
    const uid=user.id,gen=sessionGeneration;
    const result=await client.from('scout_user_progress').select('payload').eq('user_id',uid).maybeSingle();
    if(uid!==user?.id || gen!==sessionGeneration)return;
    if(result.error){
      setFeedback('Cannot load cloud progress. Database setup may be incomplete: '+result.error.message);
      renderAccount();return;
    }
    bridge().setProgress(mergeProgress(bridge().getProgress(),result.data?.payload||{}));
    hydrated=true; renderAccount(); pending=true; await flush();
  }
  window.ScoutCloud={scheduleSync};
  $('#accountBtn').addEventListener('click',()=>{renderAccount();$('#accountDialog').showModal();});
  $('#closeAccount').addEventListener('click',()=>$('#accountDialog').close());
  $('#cloudEmailForm').addEventListener('submit',async e=>{
    e.preventDefault();
    if(!client)return;
    const email=$('#cloudEmail').value.trim();
    if(!email)return;
    setFeedback('Sending sign-in link…');
    const redirectTo=window.location.origin+window.location.pathname;
    const result=await client.auth.signInWithOtp({email,options:{emailRedirectTo:redirectTo,shouldCreateUser:true}});
    const code = result.error?.code || '';
    if (code === 'email_address_not_authorized' || /address not authorized/i.test(result.error?.message || '')) {
      setFeedback('Email login is not ready for classmates yet. The site owner must enable custom SMTP in Supabase.');
    } else if (code === 'over_email_send_rate_limit' || result.error?.status === 429) {
      setFeedback('Email login limit reached. The site owner needs to configure a dedicated SMTP provider; try later.');
    } else {
      setFeedback(result.error ? 'Email sign-in failed: '+result.error.message : 'Check your inbox. Open the sign-in link on the device you want to sync.');
    }
  });
  $('#cloudRefresh').addEventListener('click',async()=>{pending=true;await flush();});
  $('#cloudSignOut').addEventListener('click',async()=>{
    if(!client)return;
    const ok=await flush(true);
    if(!ok){setFeedback('Sign-out stopped because the last cloud sync failed. Export a CSV backup or retry.');return;}
    const result=await client.auth.signOut();
    if(result.error){setFeedback(result.error.message);return;}
    user=null;hydrated=false;sessionGeneration++;
    bridge().reset();setFeedback('Signed out. This browser was cleared; cloud records remain private.');
    renderAccount();
  });
  if(client){
    client.auth.onAuthStateChange((_event,session)=>{
      // Avoid awaiting another Supabase method inside an auth callback.
      setTimeout(()=>{void handleSession(session);},0);
    });
    void client.auth.getSession().then(({data,error})=>{
      if(error){setFeedback(error.message);return;}
      void handleSession(data?.session);
    });
    window.addEventListener('focus',()=>{if(user&&hydrated){pending=true;void flush();}});
  }
  renderAccount();
})();
