import { useEffect, useMemo, useState, type FormEvent, type CSSProperties } from 'react';
import {
  ArrowLeft, ArrowRight, Camera, Check, CheckCircle2, ChevronRight, Clock3, Compass,
  Crosshair, HeartHandshake, Info, Leaf, LocateFixed, MapPin, Menu, Plus, RefreshCw,
  Send, ShieldCheck, SlidersHorizontal, Sparkles, Users, X,
} from 'lucide-react';
import { CATEGORIES, type CategoryId, type Issue, type IssueGeoJson } from '@eco/shared';
import MapView from './components/MapView';
import CategoryIcon from './components/CategoryIcon';
import { ApiRequestError, confirmIssue, fetchIssue, fetchIssues, fetchNearby, submitReport, publicMediaUrl } from './api';
import './styles.css';
import ResolvedFilter,{defaultResolvedSelection,validResolvedSelection} from './components/ResolvedFilter';

type Filter = CategoryId | 'all';
type Page = 'map' | 'report';
type Point = { longitude: number; latitude: number };
const EMPTY: IssueGeoJson = { type: 'FeatureCollection', features: [] };

function categoryInfo(id: CategoryId) { return CATEGORIES.find(c => c.id === id) ?? CATEGORIES[0]; }
function timeAgo(dateString: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(dateString).getTime()) / 1000));
  if (seconds < 60) return 'agora';
  if (seconds < 3600) return `há ${Math.floor(seconds / 60)} min`;
  if (seconds < 86400) return `há ${Math.floor(seconds / 3600)} h`;
  if (seconds < 2_592_000) return `há ${Math.floor(seconds / 86400)} dias`;
  return new Date(dateString).toLocaleDateString('pt-BR');
}
function formatCoords({ latitude, longitude }: Point) { return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`; }
function feedback(error: unknown): string {
  if (error instanceof ApiRequestError) {
    if (error.status === 429 && error.retryAfter) {
      return `Limite atingido. Tente novamente em aproximadamente ${Math.ceil(error.retryAfter / 60)} minuto(s).`;
    }
    return error.message;
  }
  return 'Algo deu errado. Tente novamente.';
}

function CategoryBadge({ category }: { category: CategoryId }) {
  const info = categoryInfo(category);
  return <span className="category-badge" style={{ '--cat-color': info.color } as CSSProperties}>
    <CategoryIcon category={category} size={15} /> {info.label}
  </span>;
}

export default function App() {
  const [page, setPage] = useState<Page>('map');
  const [filter, setFilter] = useState<Filter>('all');
  const [resolved,setResolved]=useState(defaultResolvedSelection);
  const [data, setData] = useState<IssueGeoJson>(EMPTY);
  const [bbox, setBbox] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [dataError, setDataError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Issue | null>(null);
  const [loadingSelected, setLoadingSelected] = useState(false);
  const [toast, setToast] = useState('');
  const [mobileMenu, setMobileMenu] = useState(false);
  const [pickMode, setPickMode] = useState(false);
  const [point, setPoint] = useState<Point | null>(null);
  const [flyTarget, setFlyTarget] = useState<(Point & { nonce: number }) | null>(()=>{
    const params=new URLSearchParams(location.search);
    if(!params.has('latitude')||!params.has('longitude'))return null;
    const latitude=Number(params.get('latitude')),longitude=Number(params.get('longitude'));
    return Number.isFinite(latitude)&&Number.isFinite(longitude)&&Math.abs(latitude)<=90&&Math.abs(longitude)<=180?{latitude,longitude,nonce:Date.now()}:null;
  });
  const [reportCategory, setReportCategory] = useState<CategoryId | ''>('');
  const [description, setDescription] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [nearby, setNearby] = useState<Issue[]>([]);
  const [nearbyBusy, setNearbyBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  useEffect(() => {
    if (!bbox || !validResolvedSelection(resolved)) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setIsLoading(true);
      setDataError('');
      fetchIssues(bbox, filter, controller.signal,resolved).then(value=>{if(!controller.signal.aborted)setData(value);}).catch((error: unknown) => {
        if (!controller.signal.aborted) setDataError(feedback(error));
      }).finally(() => { if (!controller.signal.aborted) setIsLoading(false); });
    }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [bbox, filter, refreshKey,resolved]);

  useEffect(() => {
    if (!selectedId) { setSelected(null); return; }
    let cancelled = false;
    setLoadingSelected(true);
    fetchIssue(selectedId).then(issue => { if (!cancelled) setSelected(issue); })
      .catch(error => { if (!cancelled) { setSelected(null); setToast(feedback(error)); } })
      .finally(() => { if (!cancelled) setLoadingSelected(false); });
    return () => { cancelled = true; };
  }, [selectedId, refreshKey]);

  useEffect(() => {
    if (!point || !reportCategory) { setNearby([]); return; }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setNearbyBusy(true);
      fetchNearby(point.longitude, point.latitude, reportCategory, controller.signal)
        .then(results => { if (!controller.signal.aborted) setNearby(results); })
        .catch(() => { if (!controller.signal.aborted) setNearby([]); })
        .finally(() => { if (!controller.signal.aborted) setNearbyBusy(false); });
    }, 420);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [point, reportCategory]);

  useEffect(() => {
    if (!photo) { setPhotoPreview(null); return; }
    const url = URL.createObjectURL(photo);
    setPhotoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 6000);
    return () => clearTimeout(timer);
  }, [toast]);

  const featureList = useMemo(() => [...data.features]
    .sort((a, b) => new Date(b.properties.lastReportedAt).getTime() - new Date(a.properties.lastReportedAt).getTime()), [data]);
  const totalReports = featureList.reduce((sum, f) => sum + f.properties.reportsCount, 0);

  function startReport() {
    setPage('report');
    setSelectedId(null);
    setMobileMenu(false);
    setPickMode(!point);
  }
  function showMap() { setPage('map'); setPickMode(false); setMobileMenu(false); }
  function pointSelected(value: Point) {
    setPoint(value);
    setPickMode(false);
  }
  function goTo(value: Point) { setFlyTarget({ ...value, nonce: Date.now() }); }
  function askLocation() {
    if (!('geolocation' in navigator)) { setToast('Geolocalização não disponível neste navegador.'); return; }
    navigator.geolocation.getCurrentPosition(
      p => { const value = { longitude: p.coords.longitude, latitude: p.coords.latitude }; pointSelected(value); goTo(value); },
      () => setToast('Não foi possível obter sua localização. Selecione um ponto no mapa.'),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  }
  function chooseIssue(id: string, position?: Point) {
    setSelectedId(id);
    setPage('map');
    setPickMode(false);
    setMobileMenu(false);
    if (position) goTo(position);
  }
  async function confirm(id: string) {
    setConfirmingId(id);
    try {
      const issue = await confirmIssue(id);
      setToast('Confirmação registrada! Obrigado por contribuir.');
      setRefreshKey(prev => prev + 1);
      setSelected(issue);
      setSelectedId(issue.id);
      setPage('map');
      setPickMode(false);
      setPoint(null);
      goTo(issue);
    } catch (error) { setToast(feedback(error)); }
    finally { setConfirmingId(null); }
  }
  async function createReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reportCategory) { setToast('Selecione uma categoria.'); return; }
    if (!point) { setPickMode(true); setToast('Selecione a localização no mapa.'); return; }
    if (photo && (!['image/jpeg','image/png','image/webp'].includes(photo.type) || photo.size > 8 * 1024 * 1024)) {
      setToast('Use JPEG, PNG ou WebP com até 8 MB.'); return;
    }
    const form = new FormData();
    form.set('category', reportCategory);
    form.set('latitude', String(point.latitude));
    form.set('longitude', String(point.longitude));
    form.set('description', description.trim());
    if (photo) form.set('photo', photo);
    setSending(true);
    try {
      const issue = await submitReport(form);
      setToast('Relato enviado! A ocorrência foi publicada como não verificada.');
      setRefreshKey(prev => prev + 1);
      setReportCategory(''); setDescription(''); setPhoto(null); setPoint(null); setNearby([]);
      chooseIssue(issue.id, issue);
    } catch (error) { setToast(feedback(error)); }
    finally { setSending(false); }
  }

  return <div className="shell">
    <aside className={`sidebar ${mobileMenu ? 'menu-open' : ''} ${page === 'report' ? 'report-active' : ''} ${pickMode && page === 'report' ? 'picking' : ''}`}>
      <div className="brandbar">
        <div className="brand-mark"><Leaf size={22} strokeWidth={2.4} /></div>
        <div className="brand-copy"><div className="brand-title">EchoVision<span>.</span></div><div className="brand-subtitle">MAPA AMBIENTAL COLABORATIVO</div></div>
        <button className="icon-button mobile-close" onClick={() => setMobileMenu(false)} aria-label="Fechar menu"><X size={20}/></button>
      </div>
      <div className="sidebar-content">
        {page === 'map' ? <>
          <div className="sidebar-intro">
            <div className="eyebrow"><span className="live-dot"/> NOSSO TERRITÓRIO, NOSSA VOZ</div>
            <h1>Um olhar coletivo<br/>sobre o <em>ambiente.</em></h1>
            <p>Encontre problemas ambientais próximos e ajude a tornar cada situação visível.</p>
          </div>
          <button className="primary-button full-width" onClick={startReport}><Plus size={19}/> Reportar um problema <ArrowRight size={18} className="push-right"/></button>
          <div className="section-heading"><span><SlidersHorizontal size={17}/> Explorar por categoria</span><span className="hint-label">{CATEGORIES.length + 1} filtros</span></div>
          <div className="filter-grid" role="group" aria-label="Filtrar ocorrências">
            <button className={`filter-chip ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}><Compass size={17}/> Todas</button>
            {CATEGORIES.map(cat => <button key={cat.id} className={`filter-chip ${filter === cat.id ? 'active' : ''}`} onClick={() => setFilter(cat.id)}>
              <span className="filter-icon" style={{ color: cat.color }}><CategoryIcon category={cat.id} size={17}/></span>{cat.label}
            </button>)}
          </div>
          <ResolvedFilter value={resolved} onChange={setResolved}/>
          <div className="section-heading reports-heading"><span><MapPin size={17}/> Ocorrências nesta área</span><span className="count-pill">{featureList.length}</span></div>
          <div className="issue-list">
            {isLoading && featureList.length === 0 && <p className="quiet-message">Carregando ocorrências...</p>}
            {dataError && <div className="inline-error">{dataError}<button onClick={() => setRefreshKey(x => x + 1)}>Tentar novamente</button></div>}
            {!isLoading && !dataError && featureList.length === 0 && <div className="empty-list"><Leaf size={27}/><strong>Nenhuma ocorrência visível</strong><span>Ainda não há relatos nessa região ou categoria. Você pode ser a primeira pessoa a reportar.</span></div>}
            {featureList.slice(0, 15).map(f => {
              const props = f.properties;
              const cat = categoryInfo(props.category);
              return <button className={`issue-list-card ${selectedId === f.id ? 'selected' : ''}`} key={f.id} onClick={() => chooseIssue(f.id, { longitude: f.geometry.coordinates[0], latitude: f.geometry.coordinates[1] })}>
                <span className="issue-icon" style={{ background: `${cat.color}18`, color: cat.color }}><CategoryIcon category={props.category} size={21}/></span>
                <span className="issue-card-text"><strong>{cat.label}{props.lifecycleStatus==='resolved'?' · ✓ Resolvida':''}</strong><span>{props.reportsCount} {props.reportsCount === 1 ? 'relato' : 'relatos'} · {timeAgo(props.lastReportedAt)}</span></span>
                <ChevronRight size={16} color="#91a29b"/>
              </button>;
            })}
          </div>
        </> : <>
          <button className="back-link" onClick={showMap}><ArrowLeft size={18}/> Voltar para o mapa</button>
          <div className="form-intro"><div className="eyebrow"><span className="live-dot"/> FAÇA A DIFERENÇA</div><h1>Reportar um<br/><em>problema.</em></h1><p>Seu relato ajuda a dar visibilidade ao que precisa de atenção.</p></div>
          <form className="report-form" onSubmit={createReport}>
            <div className="form-group"><label className="field-label"><span className="field-number">01</span> Qual é o problema? <span className="required">*</span></label>
              <div className="category-options">{CATEGORIES.map(cat => <button type="button" key={cat.id} onClick={() => setReportCategory(cat.id)} className={`category-option ${reportCategory === cat.id ? 'chosen' : ''}`}>
                <span style={{ color: cat.color }}><CategoryIcon category={cat.id} size={21}/></span><span>{cat.label}</span>{reportCategory === cat.id && <Check size={18} className="category-check"/>}
              </button>)}</div>
            </div>
            <div className="form-group"><label className="field-label"><span className="field-number">02</span> Onde aconteceu? <span className="required">*</span></label>
              {point ? <div className="location-set"><MapPin size={18}/><span><strong>Localização selecionada</strong><small>{formatCoords(point)}</small></span><button type="button" onClick={() => setPickMode(true)}>Alterar</button></div> : <div className="location-empty"><MapPin size={18}/><span>{pickMode ? 'Clique em algum ponto do mapa →' : 'Selecione no mapa ou use o GPS.'}</span></div>}
              <div className="location-actions"><button className="secondary-button" type="button" onClick={() => setPickMode(true)}><Crosshair size={16}/> Marcar no mapa</button><button className="secondary-button" type="button" onClick={askLocation}><LocateFixed size={16}/> Usar GPS</button></div>
              {nearbyBusy && <div className="nearby-note">Procurando problemas semelhantes...</div>}
              {nearby.length > 0 && <div className="nearby-panel"><div className="nearby-title"><Info size={16}/> Já existe algo parecido por perto?</div><p>Se for o mesmo problema, confirme a ocorrência em vez de criar outra.</p>
                {nearby.map(issue => <button type="button" disabled={Boolean(confirmingId)} key={issue.id} className="nearby-item" onClick={() => void confirm(issue.id)}>
                  <span><strong>{categoryInfo(issue.category).label}</strong><small>{issue.reportsCount} relatos · {timeAgo(issue.lastReportedAt)}</small></span><span className="nearby-confirm">{confirmingId === issue.id ? 'Enviando...' : 'Confirmar'} <ArrowRight size={14}/></span>
                </button>)}
              </div>}
            </div>
            <div className="form-group"><label className="field-label"><span className="field-number">03</span> Adicione detalhes <span className="optional">OPCIONAL</span></label><textarea placeholder="Descreva o que você observou, sem incluir dados pessoais..." maxLength={500} rows={3} value={description} onChange={e => setDescription(e.target.value)}/><div className="char-count">{description.length}/500</div></div>
            <div className="form-group"><label className="field-label"><span className="field-number">04</span> Anexe uma foto <span className="optional">OPCIONAL</span></label>
              {photoPreview ? <div className="photo-preview"><img src={photoPreview} alt="Pré-visualização da foto escolhida"/><button type="button" onClick={() => setPhoto(null)} aria-label="Remover foto"><X size={18}/></button></div> : <label className="upload-box"><Camera size={23}/><strong>Selecionar foto</strong><span>JPG, PNG ou WebP · máx. 8 MB</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => {
                const file = e.target.files?.[0] || null;
                if (file && file.size > 8*1024*1024) { setToast('A foto deve ter no máximo 8 MB.'); e.target.value = ''; return; }
                setPhoto(file);
              }}/></label>}
            </div>
            <div className="privacy-note"><ShieldCheck size={17}/><span>Seu relato será publicado como <strong>não verificado</strong>. Não exibimos seu IP. Fotos são reprocessadas para remover metadados.</span></div>
            <button className="primary-button full-width submit-button" type="submit" disabled={sending}>{sending ? <><RefreshCw size={18} className="spinning"/> Enviando...</> : <><Send size={18}/> Publicar relato <ArrowRight size={18} className="push-right"/></>}</button>
          </form>
        </>}
      </div>
      <div className="sidebar-bottom"><HeartHandshake size={17}/><span>Feito para cuidar do lugar onde vivemos.</span></div>
    </aside>

    <main className="main">
      <div className="topbar">
        <button className="mobile-menu-button" aria-label="Abrir menu" onClick={() => setMobileMenu(true)}><Menu size={21}/></button>
        <div className="breadcrumb"><span className="breadcrumb-label">MAPA COLABORATIVO</span><ChevronRight size={15}/><strong>{page === 'report' ? 'Nova ocorrência' : 'Explorar'}</strong></div>
        <div className="topbar-actions"><span className="status-live"><span className="live-dot"/> Comunidade ativa</span><button className="topbar-report" onClick={startReport}><Plus size={17}/> Novo relato</button></div>
      </div>
      <div className="map-area">
        <MapView features={data} picking={pickMode && page === 'report'} pinPosition={page === 'report' ? point : null} flyTo={flyTarget} onPick={pointSelected} onBounds={setBbox} onIssueClick={id => chooseIssue(id)} />
        <div className="map-top-floating">
          <div className="map-stats"><div className="stat-icon"><Leaf size={20}/></div><div><strong>{featureList.length}</strong><span>ocorrências no mapa</span></div><div className="stat-divider"/><div><strong>{totalReports}</strong><span>relatos registrados</span></div></div>
          {isLoading && <div className="loading-chip"><RefreshCw size={14} className="spinning"/> Atualizando mapa</div>}
        </div>
        {page === 'report' && pickMode && <div className="pick-instruction"><Crosshair size={18}/><span>Toque no mapa para marcar o local do problema</span><button onClick={() => setPickMode(false)} aria-label="Cancelar seleção"><X size={16}/></button></div>}
        {page === 'map' && selectedId && <div className="detail-card">
          <button className="detail-close" aria-label="Fechar detalhes" onClick={() => setSelectedId(null)}><X size={19}/></button>
          {loadingSelected && !selected ? <div className="detail-loading">Carregando ocorrência...</div> : selected && <>
            {selected.imageUrl ? <img className="detail-image" src={publicMediaUrl(selected.imageUrl)} alt="Foto enviada por um usuário para ilustrar o relato"/> : <div className="detail-placeholder"><CategoryIcon category={selected.category} size={35}/><span>Foto não enviada</span></div>}
            <div className="detail-body"><CategoryBadge category={selected.category}/><h2>{categoryInfo(selected.category).label}</h2>
              <p>{selected.description || 'Problema reportado por um membro da comunidade. Sem descrição adicional.'}</p>
              <div className="detail-meta"><span><Users size={16}/> {selected.reportsCount} {selected.reportsCount === 1 ? 'relato' : 'relatos'}</span><span><Clock3 size={16}/> {timeAgo(selected.lastReportedAt)}</span></div>
              <div className="detail-verification"><Info size={16}/>{selected.verificationStatus === 'verified' ? 'Ocorrência verificada por moderação' : selected.verificationStatus === 'corroborated' ? 'Corroborada por múltiplos relatos' : 'Ainda não verificada independentemente'}</div>
              {selected.lifecycleStatus==='resolved'?<div className="detail-verification"><CheckCircle2 size={18}/>Resolvida em {selected.resolvedAt?new Date(selected.resolvedAt).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}):'data não disponível'}</div>:<button className="primary-button full-width confirm-button" disabled={confirmingId === selected.id} onClick={() => void confirm(selected.id)}><CheckCircle2 size={18}/>{confirmingId === selected.id ? 'Confirmando...' : 'Confirmar que o problema continua'}</button>}
              <div className="detail-coordinates"><MapPin size={13}/>{formatCoords(selected)}</div>
            </div>
          </>}
        </div>}
        {page === 'map' && !selectedId && <div className="map-corner-note"><Sparkles size={16}/><span>Seu olhar transforma o mapa.</span></div>}
        <div className="map-legend"><span className="legend-title">LEGENDA</span><div><i className="legend-dot green"/>Ocorrência ativa</div>{resolved.includeResolved&&<div>✓ Resolvida (cinza)</div>}<div><i className="legend-dot dark"/>Grupo de locais</div><span className="legend-caption">Pin maior = mais relatos</span></div>
      </div>
      <div className="mobile-bottom"><button className={page === 'map' ? 'mobile-tab active' : 'mobile-tab'} onClick={showMap}><Compass size={19}/> Ver mapa</button><button className={page === 'report' ? 'mobile-tab active' : 'mobile-tab'} onClick={startReport}><Plus size={20}/> Reportar</button></div>
    </main>
    {toast && <div className="toast" role="status"><span className="toast-mark"><CheckCircle2 size={18}/></span><span>{toast}</span><button onClick={() => setToast('')} aria-label="Fechar aviso"><X size={16}/></button></div>}
    {mobileMenu && <button className="mobile-shade" aria-label="Fechar menu" onClick={() => setMobileMenu(false)}/>}
  </div>;
}
