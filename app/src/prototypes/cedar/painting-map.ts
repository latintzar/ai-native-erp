/* GENERATED SUBJECT INDEX — rebuild the PAINTINGS rows with `python3 library/paintings/build_map.py`.
 * The reviewed CURATED_EXACT_SKU_ALIASES block below is retained deliberately: it is Product Sheet
 * evidence, not a fuzzy catalogue-match rule.
 *
 * THE PAINTED LIBRARY'S FACE IN THE APP (THE-DENSE-BRIEF §B/§C). Generated from
 * library/paintings/manifest.json — the ladder-labeled set the pipeline produced, filtered to the
 * slugs that actually have a normalized tile in library/paintings/set/.
 *
 * `paintingFor(name)` resolves a product's WORD to a painting the way the router resolves words
 * to nodes: exact name, then the look-distinct sort (L2), then the kind (L1). A miss returns
 * null and the caller keeps its line icon — the painting is a face, never a requirement.
 *
 * `cat: 1` marks a CATEGORY FACE (§35.8) — the creature or the shelf that stands for a whole
 * category. Those names are short and would otherwise win inside longer product names by
 * accident, so every rung tries product rows first and falls back to the faces.
 */
export type Painting = {
  slug: string;
  es: string;
  l1: string;
  l2: string;
  l3: string;
  /** a category face, consulted only when no product row matched */
  cat?: 1;
  /** a commissioned COMBINATION (§35.8) — addressed by slug from the partner card it was
   *  commissioned for, never reached by resolving a product's word. */
  combo?: 1;
};

export const PAINTINGS: Painting[] = [
  /* ── fish ── */
  { slug: 'abadejo-lomos', es: 'Abadejo · lomos', l1: 'abadejo', l2: '', l3: 'lomos' },
  { slug: 'atun-lomos', es: 'Atún · lomos', l1: 'atun', l2: '', l3: 'lomos' },
  { slug: 'atun-rodajas', es: 'Atún · rodajas', l1: 'atun', l2: '', l3: 'rodajas' },
  { slug: 'atun-tacos', es: 'Atún · tacos', l1: 'atun', l2: '', l3: 'tacos' },
  { slug: 'bacalao-desalado', es: 'Bacalao · desalado', l1: 'bacalao', l2: '', l3: 'desalado' },
  { slug: 'bacalao-migas', es: 'Bacalao · migas', l1: 'bacalao', l2: '', l3: 'migas' },
  { slug: 'bonito-lomos', es: 'Bonito · lomos', l1: 'bonito', l2: '', l3: 'lomos' },
  { slug: 'boqueron-salazon', es: 'Boquerón · salazon', l1: 'boqueron', l2: '', l3: 'salazon' },
  { slug: 'caballa-eviscerado', es: 'Caballa · eviscerado', l1: 'caballa', l2: '', l3: 'eviscerado' },
  { slug: 'cazon-tacos', es: 'Cazón · tacos', l1: 'cazon', l2: '', l3: 'tacos' },
  { slug: 'gallo-filetes', es: 'Gallo · filetes', l1: 'gallo', l2: '', l3: 'filetes' },
  { slug: 'jurel-filetes', es: 'Jurel · filetes', l1: 'jurel', l2: '', l3: 'filetes' },
  { slug: 'lenguado-filetes', es: 'Lenguado · filetes', l1: 'lenguado', l2: '', l3: 'filetes' },
  { slug: 'lubina-lomos', es: 'Lubina · lomos', l1: 'lubina', l2: '', l3: 'lomos' },
  { slug: 'merluza-eviscerado', es: 'Merluza · eviscerado', l1: 'merluza', l2: '', l3: 'eviscerado' },
  { slug: 'merluza-tacos', es: 'Merluza · tacos', l1: 'merluza', l2: '', l3: 'tacos' },
  { slug: 'mero-lomos', es: 'Mero · lomos', l1: 'mero', l2: '', l3: 'lomos' },
  { slug: 'mero-rodajas', es: 'Mero · rodajas', l1: 'mero', l2: '', l3: 'rodajas' },
  { slug: 'pez-espada-rodajas', es: 'Pez espada · rodajas', l1: 'pez-espada', l2: '', l3: 'rodajas' },
  { slug: 'pez-espada-tacos', es: 'Pez espada · tacos', l1: 'pez-espada', l2: '', l3: 'tacos' },
  { slug: 'rape-lomos', es: 'Rape · lomos', l1: 'rape', l2: '', l3: 'lomos' },
  { slug: 'rape-tacos', es: 'Rape · tacos', l1: 'rape', l2: '', l3: 'tacos' },
  { slug: 'raya-limpio', es: 'Raya · limpio', l1: 'raya', l2: '', l3: 'limpio' },
  { slug: 'rodaballo-filetes', es: 'Rodaballo · filetes', l1: 'rodaballo', l2: '', l3: 'filetes' },
  { slug: 'rosada-lomos', es: 'Rosada · lomos', l1: 'rosada', l2: '', l3: 'lomos' },
  { slug: 'salmon-ahumado', es: 'Salmón · ahumado', l1: 'salmon', l2: '', l3: 'ahumado' },
  { slug: 'salmon-lomos', es: 'Salmón · lomos', l1: 'salmon', l2: '', l3: 'lomos' },
  { slug: 'salmon-rodajas', es: 'Salmón · rodajas', l1: 'salmon', l2: '', l3: 'rodajas' },
  { slug: 'salmon-tacos', es: 'Salmón · tacos', l1: 'salmon', l2: '', l3: 'tacos' },
  { slug: 'salmonete-eviscerado', es: 'Salmonete · eviscerado', l1: 'salmonete', l2: '', l3: 'eviscerado' },
  { slug: 'salmonete-filetes', es: 'Salmonete · filetes', l1: 'salmonete', l2: '', l3: 'filetes' },
  { slug: 'sardina-eviscerado', es: 'Sardina · eviscerado', l1: 'sardina', l2: '', l3: 'eviscerado' },
  { slug: 'sardina-filetes', es: 'Sardina · filetes', l1: 'sardina', l2: '', l3: 'filetes' },
  { slug: 'trucha-eviscerado', es: 'Trucha · eviscerado', l1: 'trucha', l2: '', l3: 'eviscerado' },
  { slug: 'trucha-filetes', es: 'Trucha · filetes', l1: 'trucha', l2: '', l3: 'filetes' },
  { slug: 'abadejo', es: 'Abadejo', l1: 'abadejo', l2: '', l3: 'entero' },
  { slug: 'acedia', es: 'Acedía', l1: 'acedia', l2: '', l3: 'entero' },
  { slug: 'aguja', es: 'Aguja', l1: 'aguja', l2: '', l3: 'entero' },
  { slug: 'alacha', es: 'Alacha', l1: 'alacha', l2: '', l3: 'entero' },
  { slug: 'aligote', es: 'Aligote', l1: 'aligote', l2: '', l3: 'entero' },
  { slug: 'ancas-de-rana', es: 'Ancas de rana', l1: 'ancas-de-rana', l2: '', l3: 'pieza' },
  { slug: 'anguila', es: 'Anguila', l1: 'anguila', l2: '', l3: 'entero' },
  { slug: 'angula', es: 'Angula', l1: 'angula', l2: '', l3: 'pieza' },
  { slug: 'arenque', es: 'Arenque', l1: 'arenque', l2: '', l3: 'entero' },
  { slug: 'bacaladilla', es: 'Bacaladilla', l1: 'bacaladilla', l2: '', l3: 'entero' },
  { slug: 'bacalao', es: 'Bacalao', l1: 'bacalao', l2: '', l3: 'entero' },
  { slug: 'barrilete', es: 'Barrilete', l1: 'barrilete', l2: '', l3: 'entero' },
  { slug: 'bertorella', es: 'Bertorella', l1: 'bertorella', l2: '', l3: 'entero' },
  { slug: 'besugo', es: 'Besugo', l1: 'besugo', l2: '', l3: 'entero' },
  { slug: 'boga', es: 'Boga', l1: 'boga', l2: '', l3: 'entero' },
  { slug: 'bonito', es: 'Bonito', l1: 'bonito', l2: '', l3: 'entero' },
  { slug: 'boqueron', es: 'Boquerón', l1: 'boqueron', l2: '', l3: 'entero' },
  { slug: 'breca', es: 'Breca', l1: 'breca', l2: '', l3: 'entero' },
  { slug: 'caballa', es: 'Caballa', l1: 'caballa', l2: '', l3: 'entero' },
  { slug: 'cabracho', es: 'Cabracho', l1: 'cabracho', l2: '', l3: 'entero' },
  { slug: 'carbonero', es: 'Carbonero', l1: 'carbonero', l2: '', l3: 'entero' },
  { slug: 'cherna', es: 'Cherna', l1: 'cherna', l2: '', l3: 'entero' },
  { slug: 'chopa', es: 'Chopa', l1: 'chopa', l2: '', l3: 'entero' },
  { slug: 'cococha', es: 'Cococha', l1: 'cococha', l2: '', l3: 'pieza' },
  { slug: 'corvina', es: 'Corvina', l1: 'corvina', l2: '', l3: 'entero' },
  { slug: 'denton', es: 'Dentón', l1: 'denton', l2: '', l3: 'entero' },
  { slug: 'dorada', es: 'Dorada', l1: 'dorada', l2: '', l3: 'entero' },
  { slug: 'faneca', es: 'Faneca', l1: 'faneca', l2: '', l3: 'entero' },
  { slug: 'fletan', es: 'Fletán', l1: 'fletan', l2: '', l3: 'entero' },
  { slug: 'gallineta', es: 'Gallineta', l1: 'gallineta', l2: '', l3: 'entero' },
  { slug: 'gallo', es: 'Gallo', l1: 'gallo', l2: '', l3: 'entero' },
  { slug: 'gula', es: 'Gula', l1: 'gula', l2: '', l3: 'pieza' },
  { slug: 'hueva', es: 'Hueva', l1: 'hueva', l2: '', l3: 'pieza' },
  { slug: 'jurel', es: 'Jurel', l1: 'jurel', l2: '', l3: 'entero' },
  { slug: 'lenguado', es: 'Lenguado', l1: 'lenguado', l2: '', l3: 'entero' },
  { slug: 'lubina', es: 'Lubina', l1: 'lubina', l2: '', l3: 'entero' },
  { slug: 'maruca', es: 'Maruca', l1: 'maruca', l2: '', l3: 'entero' },
  { slug: 'melva', es: 'Melva', l1: 'melva', l2: '', l3: 'entero' },
  { slug: 'merluza', es: 'Merluza', l1: 'merluza', l2: '', l3: 'entero' },
  { slug: 'mero', es: 'Mero', l1: 'mero', l2: '', l3: 'entero' },
  { slug: 'mojama', es: 'Mojama', l1: 'mojama', l2: '', l3: 'pieza' },
  { slug: 'mujol', es: 'Mujol', l1: 'mujol', l2: '', l3: 'entero' },
  { slug: 'palometa', es: 'Palometa', l1: 'palometa', l2: '', l3: 'entero' },
  { slug: 'pargo', es: 'Pargo', l1: 'pargo', l2: '', l3: 'entero' },
  { slug: 'perlon', es: 'Perlón', l1: 'perlon', l2: '', l3: 'entero' },
  { slug: 'pez-de-san-pedro', es: 'Pez de San Pedro', l1: 'pez-san-pedro', l2: '', l3: 'entero' },
  { slug: 'pintarroja', es: 'Pintarroja', l1: 'pintarroja', l2: '', l3: 'entero' },
  { slug: 'platija', es: 'Platija', l1: 'platija', l2: '', l3: 'entero' },
  { slug: 'rape', es: 'Rape', l1: 'rape', l2: '', l3: 'entero' },
  { slug: 'raya', es: 'Raya', l1: 'raya', l2: '', l3: 'entero' },
  { slug: 'rodaballo', es: 'Rodaballo', l1: 'rodaballo', l2: '', l3: 'entero' },
  { slug: 'rosada', es: 'Rosada', l1: 'rosada', l2: '', l3: 'entero' },
  { slug: 'salmon', es: 'Salmón', l1: 'salmon', l2: '', l3: 'entero' },
  { slug: 'salmonete', es: 'Salmonete', l1: 'salmonete', l2: '', l3: 'entero' },
  { slug: 'sardina', es: 'Sardina', l1: 'sardina', l2: '', l3: 'entero' },
  { slug: 'sargo', es: 'Sargo', l1: 'sargo', l2: '', l3: 'entero' },
  { slug: 'solla', es: 'Solla', l1: 'solla', l2: '', l3: 'entero' },
  { slug: 'surimi', es: 'Surimi', l1: 'surimi', l2: '', l3: 'pieza' },
  { slug: 'trucha', es: 'Trucha', l1: 'trucha', l2: '', l3: 'entero' },
  { slug: 'vieja', es: 'Vieja', l1: 'vieja', l2: '', l3: 'entero' },
  { slug: 'virrey', es: 'Virrey', l1: 'virrey', l2: '', l3: 'entero' },
  { slug: 'acedia-filetes', es: 'Acedía · filetes', l1: 'acedia', l2: '', l3: 'filetes' },
  { slug: 'aguja-eviscerado', es: 'Aguja · eviscerado', l1: 'aguja', l2: '', l3: 'eviscerado' },
  { slug: 'alacha-eviscerado', es: 'Alacha · eviscerado', l1: 'alacha', l2: '', l3: 'eviscerado' },
  { slug: 'aligote-eviscerado', es: 'Aligote · eviscerado', l1: 'aligote', l2: '', l3: 'eviscerado' },
  { slug: 'arenque-filetes', es: 'Arenque · filetes', l1: 'arenque', l2: '', l3: 'filetes' },
  { slug: 'bacalao-lomos', es: 'Bacalao · lomos', l1: 'bacalao', l2: '', l3: 'lomos' },
  { slug: 'barrilete-lomos', es: 'Barrilete · lomos', l1: 'barrilete', l2: '', l3: 'lomos' },
  { slug: 'bertorella-eviscerado', es: 'Bertorella · eviscerado', l1: 'bertorella', l2: '', l3: 'eviscerado' },
  { slug: 'besugo-eviscerado', es: 'Besugo · eviscerado', l1: 'besugo', l2: '', l3: 'eviscerado' },
  { slug: 'boga-eviscerado', es: 'Boga · eviscerado', l1: 'boga', l2: '', l3: 'eviscerado' },
  { slug: 'bonito-rodajas', es: 'Bonito · rodajas', l1: 'bonito', l2: '', l3: 'rodajas' },
  { slug: 'boqueron-filetes', es: 'Boquerón · filetes', l1: 'boqueron', l2: '', l3: 'filetes' },
  { slug: 'breca-eviscerado', es: 'Breca · eviscerado', l1: 'breca', l2: '', l3: 'eviscerado' },
  { slug: 'caballa-filetes', es: 'Caballa · filetes', l1: 'caballa', l2: '', l3: 'filetes' },
  { slug: 'carbonero-lomos', es: 'Carbonero · lomos', l1: 'carbonero', l2: '', l3: 'lomos' },
  { slug: 'cherna-lomos', es: 'Cherna · lomos', l1: 'cherna', l2: '', l3: 'lomos' },
  { slug: 'cherna-rodajas', es: 'Cherna · rodajas', l1: 'cherna', l2: '', l3: 'rodajas' },
  { slug: 'chopa-eviscerado', es: 'Chopa · eviscerado', l1: 'chopa', l2: '', l3: 'eviscerado' },
  { slug: 'congrio-rodajas', es: 'Congrio · rodajas', l1: 'congrio', l2: '', l3: 'rodajas' },
  { slug: 'corvina-lomos', es: 'Corvina · lomos', l1: 'corvina', l2: '', l3: 'lomos' },
  { slug: 'corvina-rodajas', es: 'Corvina · rodajas', l1: 'corvina', l2: '', l3: 'rodajas' },
  { slug: 'denton-lomos', es: 'Dentón · lomos', l1: 'denton', l2: '', l3: 'lomos' },
  { slug: 'dorada-eviscerado', es: 'Dorada · eviscerado', l1: 'dorada', l2: '', l3: 'eviscerado' },
  { slug: 'dorada-filetes', es: 'Dorada · filetes', l1: 'dorada', l2: '', l3: 'filetes' },
  { slug: 'faneca-eviscerado', es: 'Faneca · eviscerado', l1: 'faneca', l2: '', l3: 'eviscerado' },
  { slug: 'fletan-lomos', es: 'Fletán · lomos', l1: 'fletan', l2: '', l3: 'lomos' },
  { slug: 'fletan-rodajas', es: 'Fletán · rodajas', l1: 'fletan', l2: '', l3: 'rodajas' },
  { slug: 'gallineta-lomos', es: 'Gallineta · lomos', l1: 'gallineta', l2: '', l3: 'lomos' },
  { slug: 'lubina-eviscerado', es: 'Lubina · eviscerado', l1: 'lubina', l2: '', l3: 'eviscerado' },
  { slug: 'lubina-filetes', es: 'Lubina · filetes', l1: 'lubina', l2: '', l3: 'filetes' },
  { slug: 'maruca-lomos', es: 'Maruca · lomos', l1: 'maruca', l2: '', l3: 'lomos' },
  { slug: 'melva-lomos', es: 'Melva · lomos', l1: 'melva', l2: '', l3: 'lomos' },
  { slug: 'merluza-filetes', es: 'Merluza · filetes', l1: 'merluza', l2: '', l3: 'filetes' },
  { slug: 'merluza-lomos', es: 'Merluza · lomos', l1: 'merluza', l2: '', l3: 'lomos' },
  { slug: 'merluza-rodajas', es: 'Merluza · rodajas', l1: 'merluza', l2: '', l3: 'rodajas' },
  { slug: 'mojama-lonchas', es: 'Mojama · lonchas', l1: 'mojama', l2: '', l3: 'lonchas' },
  { slug: 'mujol-eviscerado', es: 'Mujol · eviscerado', l1: 'mujol', l2: '', l3: 'eviscerado' },
  { slug: 'mujol-filetes', es: 'Mujol · filetes', l1: 'mujol', l2: '', l3: 'filetes' },
  { slug: 'palometa-filetes', es: 'Palometa · filetes', l1: 'palometa', l2: '', l3: 'filetes' },
  { slug: 'panga-filetes', es: 'Panga · filetes', l1: 'panga', l2: '', l3: 'filetes' },
  { slug: 'pargo-eviscerado', es: 'Pargo · eviscerado', l1: 'pargo', l2: '', l3: 'eviscerado' },
  { slug: 'pargo-lomos', es: 'Pargo · lomos', l1: 'pargo', l2: '', l3: 'lomos' },
  { slug: 'perca-filetes', es: 'Perca · filetes', l1: 'perca', l2: '', l3: 'filetes' },
  { slug: 'perca-lomos', es: 'Perca · lomos', l1: 'perca', l2: '', l3: 'lomos' },
  { slug: 'perlon-eviscerado', es: 'Perlón · eviscerado', l1: 'perlon', l2: '', l3: 'eviscerado' },
  { slug: 'pez-de-san-pedro-filetes', es: 'Pez de San Pedro · filetes', l1: 'pez-san-pedro', l2: '', l3: 'filetes' },
  { slug: 'pintarroja-limpio', es: 'Pintarroja · limpio', l1: 'pintarroja', l2: '', l3: 'limpio' },
  { slug: 'platija-filetes', es: 'Platija · filetes', l1: 'platija', l2: '', l3: 'filetes' },
  { slug: 'sargo-eviscerado', es: 'Sargo · eviscerado', l1: 'sargo', l2: '', l3: 'eviscerado' },
  { slug: 'solla-filetes', es: 'Solla · filetes', l1: 'solla', l2: '', l3: 'filetes' },
  { slug: 'tilapia-filetes', es: 'Tilapia · filetes', l1: 'tilapia', l2: '', l3: 'filetes' },
  { slug: 'vieja-eviscerado', es: 'Vieja · eviscerado', l1: 'vieja', l2: '', l3: 'eviscerado' },
  { slug: 'arenque-ahumado', es: 'Arenque · ahumado', l1: 'arenque', l2: '', l3: 'ahumado' },
  /* ── shellfish ── */
  { slug: 'almeja-fina-abierta', es: 'Almeja fina · abierta', l1: 'almeja-fina', l2: '', l3: 'abierta' },
  { slug: 'bogavante-cocido', es: 'Bogavante · cocido', l1: 'bogavante', l2: '', l3: 'cocido' },
  { slug: 'buey-de-mar-cocido', es: 'Buey de mar · cocido', l1: 'buey-de-mar', l2: '', l3: 'cocido' },
  { slug: 'calamar-anillas', es: 'Calamar · anillas', l1: 'calamar', l2: '', l3: 'anillas' },
  { slug: 'calamar-limpio', es: 'Calamar · limpio', l1: 'calamar', l2: '', l3: 'limpio' },
  { slug: 'centollo-cocido', es: 'Centollo · cocido', l1: 'centollo', l2: '', l3: 'cocido' },
  { slug: 'chipiron-limpio', es: 'Chipirón · limpio', l1: 'chipiron', l2: '', l3: 'limpio' },
  { slug: 'cigala-cocido', es: 'Cigala · cocido', l1: 'cigala', l2: '', l3: 'cocido' },
  { slug: 'erizo-de-mar-abierta', es: 'Erizo de mar · abierta', l1: 'erizo-de-mar', l2: '', l3: 'abierta' },
  { slug: 'gamba-blanca-cocido', es: 'Gamba blanca · cocido', l1: 'gamba-blanca', l2: '', l3: 'cocido' },
  { slug: 'gamba-blanca-pelado', es: 'Gamba blanca · pelado', l1: 'gamba-blanca', l2: '', l3: 'pelado' },
  { slug: 'gamba-roja-cocido', es: 'Gamba roja · cocido', l1: 'gamba-roja', l2: '', l3: 'cocido' },
  { slug: 'gamba-roja-congelado', es: 'Gamba roja · congelado', l1: 'gamba-roja', l2: '', l3: 'congelado' },
  { slug: 'gamba-roja-pelado', es: 'Gamba roja · pelado', l1: 'gamba-roja', l2: '', l3: 'pelado' },
  { slug: 'langosta-cocido', es: 'Langosta · cocido', l1: 'langosta', l2: '', l3: 'cocido' },
  { slug: 'langostino-cocido', es: 'Langostino · cocido', l1: 'langostino', l2: '', l3: 'cocido' },
  { slug: 'langostino-pelado', es: 'Langostino · pelado', l1: 'langostino', l2: '', l3: 'pelado' },
  { slug: 'mejillon-abierta', es: 'Mejillón · abierta', l1: 'mejillon', l2: '', l3: 'abierta' },
  { slug: 'mejillon-limpio', es: 'Mejillón · limpio', l1: 'mejillon', l2: '', l3: 'limpio' },
  { slug: 'necora-cocido', es: 'Nécora · cocido', l1: 'necora', l2: '', l3: 'cocido' },
  { slug: 'ostra-abierta', es: 'Ostra · abierta', l1: 'ostra', l2: '', l3: 'abierta' },
  { slug: 'pulpo-cocido', es: 'Pulpo · cocido', l1: 'pulpo', l2: '', l3: 'cocido' },
  { slug: 'pulpo-pata', es: 'Pulpo · pata', l1: 'pulpo', l2: '', l3: 'pata' },
  { slug: 'sepia-limpio', es: 'Sepia · limpio', l1: 'sepia', l2: '', l3: 'limpio' },
  { slug: 'sepia-tiras', es: 'Sepia · tiras', l1: 'sepia', l2: '', l3: 'tiras' },
  { slug: 'vieira-limpio', es: 'Vieira · limpio', l1: 'vieira', l2: '', l3: 'limpio' },
  { slug: 'almeja', es: 'Almeja', l1: 'almeja', l2: '', l3: 'entero' },
  { slug: 'almeja-fina', es: 'Almeja fina', l1: 'almeja-fina', l2: '', l3: 'entero' },
  { slug: 'berberecho', es: 'Berberecho', l1: 'berberecho', l2: '', l3: 'entero' },
  { slug: 'bigaro', es: 'Bígaro', l1: 'bigaro', l2: '', l3: 'entero' },
  { slug: 'bogavante', es: 'Bogavante', l1: 'bogavante', l2: '', l3: 'entero' },
  { slug: 'buey-de-mar', es: 'Buey de mar', l1: 'buey-de-mar', l2: '', l3: 'entero' },
  { slug: 'calamar', es: 'Calamar', l1: 'calamar', l2: '', l3: 'entero' },
  { slug: 'canailla', es: 'Cañaílla', l1: 'canailla', l2: '', l3: 'entero' },
  { slug: 'carabinero', es: 'Carabinero', l1: 'carabinero', l2: '', l3: 'entero' },
  { slug: 'centollo', es: 'Centollo', l1: 'centollo', l2: '', l3: 'entero' },
  { slug: 'chipiron', es: 'Chipirón', l1: 'chipiron', l2: '', l3: 'entero' },
  { slug: 'chirla', es: 'Chirla', l1: 'chirla', l2: '', l3: 'entero' },
  { slug: 'choquito', es: 'Choquito', l1: 'choquito', l2: '', l3: 'entero' },
  { slug: 'cigala', es: 'Cigala', l1: 'cigala', l2: '', l3: 'entero' },
  { slug: 'coquina', es: 'Coquina', l1: 'coquina', l2: '', l3: 'entero' },
  { slug: 'erizo-de-mar', es: 'Erizo de mar', l1: 'erizo-de-mar', l2: '', l3: 'entero' },
  { slug: 'escupina', es: 'Escupiña', l1: 'escupina', l2: '', l3: 'entero' },
  { slug: 'galera', es: 'Galera', l1: 'galera', l2: '', l3: 'entero' },
  { slug: 'gamba-blanca', es: 'Gamba blanca', l1: 'gamba-blanca', l2: '', l3: 'entero' },
  { slug: 'gamba-roja', es: 'Gamba roja', l1: 'gamba-roja', l2: '', l3: 'entero' },
  { slug: 'gambon', es: 'Gambón', l1: 'gambon', l2: '', l3: 'entero' },
  { slug: 'langosta', es: 'Langosta', l1: 'langosta', l2: '', l3: 'entero' },
  { slug: 'langostino', es: 'Langostino', l1: 'langostino', l2: '', l3: 'entero' },
  { slug: 'mejillon', es: 'Mejillón', l1: 'mejillon', l2: '', l3: 'entero' },
  { slug: 'navaja', es: 'Navaja', l1: 'navaja', l2: '', l3: 'entero' },
  { slug: 'necora', es: 'Nécora', l1: 'necora', l2: '', l3: 'entero' },
  { slug: 'ostra', es: 'Ostra', l1: 'ostra', l2: '', l3: 'entero' },
  { slug: 'percebe', es: 'Percebe', l1: 'percebe', l2: '', l3: 'entero' },
  { slug: 'pota', es: 'Pota', l1: 'pota', l2: '', l3: 'entero' },
  { slug: 'pulpo', es: 'Pulpo', l1: 'pulpo', l2: '', l3: 'entero' },
  { slug: 'quisquilla', es: 'Quisquilla', l1: 'quisquilla', l2: '', l3: 'entero' },
  { slug: 'sepia', es: 'Sepia', l1: 'sepia', l2: '', l3: 'entero' },
  { slug: 'vieira', es: 'Vieira', l1: 'vieira', l2: '', l3: 'entero' },
  { slug: 'zamburina', es: 'Zamburiña', l1: 'zamburina', l2: '', l3: 'entero' },
  { slug: 'almeja-abierta', es: 'Almeja · abierta', l1: 'almeja', l2: '', l3: 'abierta' },
  { slug: 'canailla-cocido', es: 'Cañaílla · cocido', l1: 'canailla', l2: '', l3: 'cocido' },
  { slug: 'chirla-abierta', es: 'Chirla · abierta', l1: 'chirla', l2: '', l3: 'abierta' },
  { slug: 'choquito-limpio', es: 'Choquito · limpio', l1: 'choquito', l2: '', l3: 'limpio' },
  { slug: 'escupina-abierta', es: 'Escupiña · abierta', l1: 'escupina', l2: '', l3: 'abierta' },
  { slug: 'gambon-cocido', es: 'Gambón · cocido', l1: 'gambon', l2: '', l3: 'cocido' },
  { slug: 'gambon-pelado', es: 'Gambón · pelado', l1: 'gambon', l2: '', l3: 'pelado' },
  { slug: 'pota-limpio', es: 'Pota · limpio', l1: 'pota', l2: '', l3: 'limpio' },
  { slug: 'pota-anillas', es: 'Pota · anillas', l1: 'pota', l2: '', l3: 'anillas' },
  /* ── meat ── */
  { slug: 'aguja-de-ternera-filetes', es: 'Aguja de ternera · filetes', l1: 'aguja-de-ternera', l2: '', l3: 'filetes' },
  { slug: 'aguja-de-ternera-tacos', es: 'Aguja de ternera · tacos', l1: 'aguja-de-ternera', l2: '', l3: 'tacos' },
  { slug: 'bacon-lonchas', es: 'Bacon · lonchas', l1: 'bacon', l2: '', l3: 'lonchas' },
  { slug: 'cecina-lonchas', es: 'Cecina · lonchas', l1: 'cecina', l2: '', l3: 'lonchas' },
  { slug: 'chorizo-lonchas', es: 'Chorizo · lonchas', l1: 'chorizo', l2: '', l3: 'lonchas' },
  { slug: 'conejo-troceado', es: 'Conejo troceado', l1: 'conejo', l2: '', l3: 'pieza' },
  { slug: 'contramuslo-de-pollo-deshuesado', es: 'Contramuslo de pollo · deshuesado', l1: 'contramuslo-de-pollo', l2: '', l3: 'deshuesado' },
  { slug: 'costillar-de-cerdo-troceado', es: 'Costillar de cerdo · troceado', l1: 'costillar-de-cerdo', l2: '', l3: 'troceado' },
  { slug: 'costillar-de-ternera-troceado', es: 'Costillar de ternera · troceado', l1: 'costillar-de-ternera', l2: '', l3: 'troceado' },
  { slug: 'cuello-de-cordero-troceado', es: 'Cuello de cordero · troceado', l1: 'cuello-de-cordero', l2: '', l3: 'troceado' },
  { slug: 'falda-de-ternera-tacos', es: 'Falda de ternera · tacos', l1: 'falda-de-ternera', l2: '', l3: 'tacos' },
  { slug: 'jamon-iberico-lonchas', es: 'Jamón ibérico · lonchas', l1: 'jamon-iberico', l2: '', l3: 'lonchas' },
  { slug: 'jamon-serrano-lonchas', es: 'Jamón serrano · lonchas', l1: 'jamon-serrano', l2: '', l3: 'lonchas' },
  { slug: 'lomo-alto-de-ternera-filetes', es: 'Lomo alto de ternera · filetes', l1: 'lomo-alto-de-ternera', l2: '', l3: 'filetes' },
  { slug: 'lomo-bajo-de-ternera-filetes', es: 'Lomo bajo de ternera · filetes', l1: 'lomo-bajo-de-ternera', l2: '', l3: 'filetes' },
  { slug: 'lomo-de-cerdo-filetes', es: 'Lomo de cerdo · filetes', l1: 'lomo-de-cerdo', l2: '', l3: 'filetes' },
  { slug: 'lomo-de-cerdo-tacos', es: 'Lomo de cerdo · tacos', l1: 'lomo-de-cerdo', l2: '', l3: 'tacos' },
  { slug: 'lomo-embuchado-lonchas', es: 'Lomo embuchado · lonchas', l1: 'lomo-embuchado', l2: '', l3: 'lonchas' },
  { slug: 'magret-de-pato-filetes', es: 'Magret de pato · filetes', l1: 'magret-de-pato', l2: '', l3: 'filetes' },
  { slug: 'morcillo-de-ternera-tacos', es: 'Morcillo de ternera · tacos', l1: 'morcillo-de-ternera', l2: '', l3: 'tacos' },
  { slug: 'paletilla-de-cordero-deshuesado', es: 'Paletilla de cordero · deshuesado', l1: 'paletilla-de-cordero', l2: '', l3: 'deshuesado' },
  { slug: 'paletilla-de-cordero-troceado', es: 'Paletilla de cordero · troceado', l1: 'paletilla-de-cordero', l2: '', l3: 'troceado' },
  { slug: 'panceta-curada-lonchas', es: 'Panceta curada · lonchas', l1: 'panceta-curada', l2: '', l3: 'lonchas' },
  { slug: 'panceta-de-cerdo-lonchas', es: 'Panceta de cerdo · lonchas', l1: 'panceta-de-cerdo', l2: '', l3: 'lonchas' },
  { slug: 'panceta-de-cerdo-tacos', es: 'Panceta de cerdo · tacos', l1: 'panceta-de-cerdo', l2: '', l3: 'tacos' },
  { slug: 'pechuga-de-pavo-filetes', es: 'Pechuga de pavo · filetes', l1: 'pechuga-de-pavo', l2: '', l3: 'filetes' },
  { slug: 'pechuga-de-pollo-filetes', es: 'Pechuga de pollo · filetes', l1: 'pechuga-de-pollo', l2: '', l3: 'filetes' },
  { slug: 'pechuga-de-pollo-tacos', es: 'Pechuga de pollo · tacos', l1: 'pechuga-de-pollo', l2: '', l3: 'tacos' },
  { slug: 'pierna-de-cordero-deshuesado', es: 'Pierna de cordero · deshuesado', l1: 'pierna-de-cordero', l2: '', l3: 'deshuesado' },
  { slug: 'pierna-de-cordero-troceado', es: 'Pierna de cordero · troceado', l1: 'pierna-de-cordero', l2: '', l3: 'troceado' },
  { slug: 'pollo', es: 'Pollo', l1: 'pollo', l2: '', l3: 'entero' },
  { slug: 'pollo-troceado', es: 'Pollo · troceado', l1: 'pollo', l2: '', l3: 'troceado' },
  { slug: 'rabo-de-toro-troceado', es: 'Rabo de toro · troceado', l1: 'rabo-de-toro', l2: '', l3: 'troceado' },
  { slug: 'redondo-de-ternera-filetes', es: 'Redondo de ternera · filetes', l1: 'redondo-de-ternera', l2: '', l3: 'filetes' },
  { slug: 'salchichon-lonchas', es: 'Salchichón · lonchas', l1: 'salchichon', l2: '', l3: 'lonchas' },
  { slug: 'secreto-iberico', es: 'Secreto ibérico', l1: 'secreto-iberico', l2: '', l3: 'pieza' },
  { slug: 'solomillo-de-cerdo-medallones', es: 'Solomillo de cerdo · medallones', l1: 'solomillo-de-cerdo', l2: '', l3: 'medallones' },
  { slug: 'solomillo-de-ternera-medallones', es: 'Solomillo de ternera · medallones', l1: 'solomillo-de-ternera', l2: '', l3: 'medallones' },
  { slug: 'solomillo-de-ternera-tacos', es: 'Solomillo de ternera · tacos', l1: 'solomillo-de-ternera', l2: '', l3: 'tacos' },
  { slug: 'abanico-iberico', es: 'Abanico ibérico', l1: 'abanico-iberico', l2: '', l3: 'pieza' },
  { slug: 'aguja-de-ternera', es: 'Aguja de ternera', l1: 'aguja-de-ternera', l2: '', l3: 'pieza' },
  { slug: 'aleta-de-ternera', es: 'Aleta de ternera', l1: 'aleta-de-ternera', l2: '', l3: 'entero' },
  { slug: 'alitas-de-pollo', es: 'Alitas de pollo', l1: 'alitas-de-pollo', l2: '', l3: 'pieza' },
  { slug: 'avestruz', es: 'Avestruz', l1: 'avestruz', l2: '', l3: 'pieza' },
  { slug: 'babilla-de-ternera', es: 'Babilla de ternera', l1: 'babilla-de-ternera', l2: '', l3: 'entero' },
  { slug: 'botillo', es: 'Botillo', l1: 'botillo', l2: '', l3: 'pieza' },
  { slug: 'brazuelo-de-ternera', es: 'Brazuelo de ternera', l1: 'brazuelo-de-ternera', l2: '', l3: 'entero' },
  { slug: 'butifarra', es: 'Butifarra', l1: 'butifarra', l2: '', l3: 'pieza' },
  { slug: 'butifarra-blanca', es: 'Butifarra blanca', l1: 'butifarra-blanca', l2: '', l3: 'pieza' },
  { slug: 'butifarra-negra', es: 'Butifarra negra', l1: 'butifarra-negra', l2: '', l3: 'pieza' },
  { slug: 'cabecera-de-lomo', es: 'Cabecera de lomo', l1: 'cabecera-de-lomo', l2: '', l3: 'entero' },
  { slug: 'cadera-de-ternera', es: 'Cadera de ternera', l1: 'cadera-de-ternera', l2: '', l3: 'entero' },
  { slug: 'callos', es: 'Callos', l1: 'callos', l2: '', l3: 'pieza' },
  { slug: 'carcasa-de-pollo', es: 'Carcasa de pollo', l1: 'carcasa-de-pollo', l2: '', l3: 'pieza' },
  { slug: 'careta-de-cerdo', es: 'Careta de cerdo', l1: 'careta-de-cerdo', l2: '', l3: 'pieza' },
  { slug: 'carne-picada-de-cerdo', es: 'Carne picada de cerdo', l1: 'picada-cerdo', l2: '', l3: 'pieza' },
  { slug: 'carne-picada-de-ternera', es: 'Carne picada de ternera', l1: 'picada-ternera', l2: '', l3: 'pieza' },
  { slug: 'carrillera-de-cerdo', es: 'Carrillera de cerdo', l1: 'carrillera-de-cerdo', l2: '', l3: 'pieza' },
  { slug: 'carrillera-de-ternera', es: 'Carrillera de ternera', l1: 'carrillera-de-ternera', l2: '', l3: 'pieza' },
  { slug: 'chistorra', es: 'Chistorra', l1: 'chistorra', l2: '', l3: 'pieza' },
  { slug: 'chopped', es: 'Chopped', l1: 'chopped', l2: '', l3: 'pieza' },
  { slug: 'chorizo', es: 'Chorizo', l1: 'chorizo', l2: '', l3: 'pieza' },
  { slug: 'chorizo-sarta', es: 'Chorizo sarta', l1: 'chorizo-sarta', l2: '', l3: 'pieza' },
  { slug: 'chuleta-de-cerdo', es: 'Chuleta de cerdo', l1: 'chuleta-de-cerdo', l2: '', l3: 'pieza' },
  { slug: 'chuletero-de-cerdo', es: 'Chuletero de cerdo', l1: 'chuletero-de-cerdo', l2: '', l3: 'pieza' },
  { slug: 'chuletillas-de-cordero', es: 'Chuletillas de cordero', l1: 'chuletillas-de-cordero', l2: '', l3: 'pieza' },
  { slug: 'chuleton-de-ternera', es: 'Chuletón de ternera', l1: 'chuleton-de-ternera', l2: '', l3: 'pieza' },
  { slug: 'churrasquitos-de-cordero', es: 'Churrasquitos de cordero', l1: 'churrasquitos-de-cordero', l2: '', l3: 'pieza' },
  { slug: 'ciervo', es: 'Ciervo', l1: 'ciervo', l2: '', l3: 'pieza' },
  { slug: 'cochinillo', es: 'Cochinillo', l1: 'cochinillo', l2: '', l3: 'pieza' },
  { slug: 'codillo-de-cerdo', es: 'Codillo de cerdo', l1: 'codillo-de-cerdo', l2: '', l3: 'pieza' },
  { slug: 'codorniz', es: 'Codorniz', l1: 'codorniz', l2: '', l3: 'entero' },
  { slug: 'conejo-entero', es: 'Conejo entero', l1: 'conejo', l2: '', l3: 'entero' },
  { slug: 'confit-de-pato', es: 'Confit de pato', l1: 'confit-de-pato', l2: '', l3: 'pieza' },
  { slug: 'contra-de-ternera', es: 'Contra de ternera', l1: 'contra-de-ternera', l2: '', l3: 'entero' },
  { slug: 'contramuslo-de-pavo', es: 'Contramuslo de pavo', l1: 'contramuslo-de-pavo', l2: '', l3: 'pieza' },
  { slug: 'contramuslo-de-pollo', es: 'Contramuslo de pollo', l1: 'contramuslo-de-pollo', l2: '', l3: 'pieza' },
  { slug: 'corazon', es: 'Corazón', l1: 'corazon', l2: '', l3: 'pieza' },
  { slug: 'cordero-entero', es: 'Cordero entero', l1: 'cordero-entero', l2: '', l3: 'pieza' },
  { slug: 'cordero-lechal', es: 'Cordero lechal', l1: 'cordero-lechal', l2: '', l3: 'entero' },
  { slug: 'costillar-de-cerdo', es: 'Costillar de cerdo', l1: 'costillar-de-cerdo', l2: '', l3: 'pieza' },
  { slug: 'costillar-de-cordero', es: 'Costillar de cordero', l1: 'costillar-de-cordero', l2: '', l3: 'pieza' },
  { slug: 'costillar-de-ternera', es: 'Costillar de ternera', l1: 'costillar-de-ternera', l2: '', l3: 'pieza' },
  { slug: 'criadillas', es: 'Criadillas', l1: 'criadillas', l2: '', l3: 'pieza' },
  { slug: 'cuarto-trasero-de-pollo', es: 'Cuarto trasero de pollo', l1: 'cuarto-trasero-de-pollo', l2: '', l3: 'pieza' },
  { slug: 'cuello-de-cordero', es: 'Cuello de cordero', l1: 'cuello-de-cordero', l2: '', l3: 'pieza' },
  { slug: 'entrecot-de-ternera', es: 'Entrecot de ternera', l1: 'entrecot-de-ternera', l2: '', l3: 'pieza' },
  { slug: 'equino', es: 'Equino', l1: 'equino', l2: '', l3: 'pieza' },
  { slug: 'espaldilla-de-ternera', es: 'Espaldilla de ternera', l1: 'espaldilla-de-ternera', l2: '', l3: 'entero' },
  { slug: 'falda-de-cordero', es: 'Falda de cordero', l1: 'falda-de-cordero', l2: '', l3: 'pieza' },
  { slug: 'falda-de-ternera', es: 'Falda de ternera', l1: 'falda-de-ternera', l2: '', l3: 'pieza' },
  { slug: 'fiambre-de-pavo', es: 'Fiambre de pavo', l1: 'fiambre-de-pavo', l2: '', l3: 'pieza' },
  { slug: 'fuet', es: 'Fuet', l1: 'fuet', l2: '', l3: 'pieza' },
  { slug: 'galantina', es: 'Galantina', l1: 'galantina', l2: '', l3: 'pieza' },
  { slug: 'gallina', es: 'Gallina', l1: 'gallina', l2: '', l3: 'pieza' },
  { slug: 'hamburguesa', es: 'Hamburguesa', l1: 'hamburguesa', l2: '', l3: 'pieza' },
  { slug: 'higaditos-de-pollo', es: 'Higaditos de pollo', l1: 'higaditos-de-pollo', l2: '', l3: 'pieza' },
  { slug: 'higado', es: 'Hígado', l1: 'higado', l2: '', l3: 'pieza' },
  { slug: 'jabali', es: 'Jabalí', l1: 'jabali', l2: '', l3: 'pieza' },
  { slug: 'jamon-cocido', es: 'Jamón cocido', l1: 'jamon-cocido', l2: '', l3: 'pieza' },
  { slug: 'jamon-fresco', es: 'Jamón fresco', l1: 'jamon-fresco', l2: '', l3: 'pieza' },
  { slug: 'jamon-iberico', es: 'Jamón ibérico', l1: 'jamon-iberico', l2: '', l3: 'pieza' },
  { slug: 'jamon-serrano', es: 'Jamón serrano', l1: 'jamon-serrano', l2: '', l3: 'pieza' },
  { slug: 'jarrete-de-cordero', es: 'Jarrete de cordero', l1: 'jarrete-de-cordero', l2: '', l3: 'pieza' },
  { slug: 'lacon', es: 'Lacón', l1: 'lacon', l2: '', l3: 'pieza' },
  { slug: 'lagarto-iberico', es: 'Lagarto ibérico', l1: 'lagarto-iberico', l2: '', l3: 'pieza' },
  { slug: 'lengua', es: 'Lengua', l1: 'lengua', l2: '', l3: 'pieza' },
  { slug: 'llana-de-ternera', es: 'Llana de ternera', l1: 'llana-de-ternera', l2: '', l3: 'entero' },
  { slug: 'lomo-alto-de-ternera', es: 'Lomo alto de ternera', l1: 'lomo-alto-de-ternera', l2: '', l3: 'pieza' },
  { slug: 'lomo-bajo-de-ternera', es: 'Lomo bajo de ternera', l1: 'lomo-bajo-de-ternera', l2: '', l3: 'pieza' },
  { slug: 'lomo-de-cerdo', es: 'Lomo de cerdo', l1: 'lomo-de-cerdo', l2: '', l3: 'pieza' },
  { slug: 'lomo-embuchado', es: 'Lomo embuchado', l1: 'lomo-embuchado', l2: '', l3: 'pieza' },
  { slug: 'longaniza', es: 'Longaniza', l1: 'longaniza', l2: '', l3: 'pieza' },
  { slug: 'magret-de-pato', es: 'Magret de pato', l1: 'magret-de-pato', l2: '', l3: 'pieza' },
  { slug: 'magro-de-cerdo', es: 'Magro de cerdo', l1: 'magro-de-cerdo', l2: '', l3: 'pieza' },
  { slug: 'manitas-de-cerdo', es: 'Manitas de cerdo', l1: 'manitas-de-cerdo', l2: '', l3: 'pieza' },
  { slug: 'manteca-de-cerdo', es: 'Manteca de cerdo', l1: 'manteca-de-cerdo', l2: '', l3: 'pieza' },
  { slug: 'media-canal-de-cerdo', es: 'Media canal de cerdo', l1: 'media-canal-de-cerdo', l2: '', l3: 'pieza' },
  { slug: 'media-canal-de-vacuno', es: 'Media canal de vacuno', l1: 'media-canal-de-vacuno', l2: '', l3: 'pieza' },
  { slug: 'mollejas', es: 'Mollejas', l1: 'mollejas', l2: '', l3: 'pieza' },
  { slug: 'morcilla', es: 'Morcilla', l1: 'morcilla', l2: '', l3: 'pieza' },
  { slug: 'morcilla-asturiana', es: 'Morcilla asturiana', l1: 'morcilla-asturiana', l2: '', l3: 'pieza' },
  { slug: 'morcilla-de-burgos', es: 'Morcilla de Burgos', l1: 'morcilla-de-burgos', l2: '', l3: 'pieza' },
  { slug: 'morcillo-de-ternera', es: 'Morcillo de ternera', l1: 'morcillo-de-ternera', l2: '', l3: 'pieza' },
  { slug: 'morcon', es: 'Morcón', l1: 'morcon', l2: '', l3: 'pieza' },
  { slug: 'mortadela', es: 'Mortadela', l1: 'mortadela', l2: '', l3: 'pieza' },
  { slug: 'muslo-de-pato', es: 'Muslo de pato', l1: 'muslo-de-pato', l2: '', l3: 'pieza' },
  { slug: 'muslo-de-pollo', es: 'Muslo de pollo', l1: 'muslo-de-pollo', l2: '', l3: 'pieza' },
  { slug: 'oreja-de-cerdo', es: 'Oreja de cerdo', l1: 'oreja-de-cerdo', l2: '', l3: 'pieza' },
  { slug: 'osobuco', es: 'Osobuco', l1: 'osobuco', l2: '', l3: 'pieza' },
  { slug: 'paleta-cocida', es: 'Paleta cocida', l1: 'paleta-cocida', l2: '', l3: 'pieza' },
  { slug: 'paleta-iberica', es: 'Paleta ibérica', l1: 'paleta-iberica', l2: '', l3: 'pieza' },
  { slug: 'paleta-serrana', es: 'Paleta serrana', l1: 'paleta-serrana', l2: '', l3: 'pieza' },
  { slug: 'paletilla-de-cerdo', es: 'Paletilla de cerdo', l1: 'paletilla-de-cerdo', l2: '', l3: 'pieza' },
  { slug: 'paletilla-de-cordero', es: 'Paletilla de cordero', l1: 'paletilla-de-cordero', l2: '', l3: 'pieza' },
  { slug: 'panceta-curada', es: 'Panceta curada', l1: 'panceta-curada', l2: '', l3: 'pieza' },
  { slug: 'panceta-de-cerdo', es: 'Panceta de cerdo', l1: 'panceta-de-cerdo', l2: '', l3: 'pieza' },
  { slug: 'papada-curada', es: 'Papada curada', l1: 'papada-curada', l2: '', l3: 'pieza' },
  { slug: 'papada-de-cerdo', es: 'Papada de cerdo', l1: 'papada-de-cerdo', l2: '', l3: 'pieza' },
  { slug: 'pate', es: 'Paté', l1: 'pate', l2: '', l3: 'pieza' },
  { slug: 'pato', es: 'Pato', l1: 'pato', l2: '', l3: 'entero' },
  { slug: 'pavo-entero', es: 'Pavo entero', l1: 'pavo', l2: '', l3: 'entero' },
  { slug: 'pechuga-de-pavo', es: 'Pechuga de pavo', l1: 'pechuga-de-pavo', l2: '', l3: 'pieza' },
  { slug: 'pechuga-de-pollo', es: 'Pechuga de pollo', l1: 'pechuga-de-pollo', l2: '', l3: 'pieza' },
  { slug: 'perdiz', es: 'Perdiz', l1: 'perdiz', l2: '', l3: 'entero' },
  { slug: 'pescuezo-de-ternera', es: 'Pescuezo de ternera', l1: 'pescuezo-de-ternera', l2: '', l3: 'entero' },
  { slug: 'pez-de-ternera', es: 'Pez de ternera', l1: 'pez-de-ternera', l2: '', l3: 'entero' },
  { slug: 'picana', es: 'Picaña', l1: 'picana', l2: '', l3: 'pieza' },
  { slug: 'pierna-de-cabrito', es: 'Pierna de cabrito', l1: 'pierna-de-cabrito', l2: '', l3: 'pieza' },
  { slug: 'pierna-de-cordero', es: 'Pierna de cordero', l1: 'pierna-de-cordero', l2: '', l3: 'pieza' },
  { slug: 'pintada', es: 'Pintada', l1: 'pintada', l2: '', l3: 'pieza' },
  { slug: 'pluma-iberica', es: 'Pluma ibérica', l1: 'pluma-iberica', l2: '', l3: 'pieza' },
  { slug: 'presa-iberica', es: 'Presa ibérica', l1: 'presa-iberica', l2: '', l3: 'pieza' },
  { slug: 'pularda', es: 'Pularda', l1: 'pularda', l2: '', l3: 'entero' },
  { slug: 'rabo-de-cerdo', es: 'Rabo de cerdo', l1: 'rabo-de-cerdo', l2: '', l3: 'pieza' },
  { slug: 'redondo-de-ternera', es: 'Redondo de ternera', l1: 'redondo-de-ternera', l2: '', l3: 'pieza' },
  { slug: 'rinon', es: 'Riñón', l1: 'rinon', l2: '', l3: 'pieza' },
  { slug: 'salami', es: 'Salami', l1: 'salami', l2: '', l3: 'pieza' },
  { slug: 'salchicha-cocida', es: 'Salchicha cocida', l1: 'salchicha-cocida', l2: '', l3: 'pieza' },
  { slug: 'salchicha-fresca', es: 'Salchicha fresca', l1: 'salchicha-fresca', l2: '', l3: 'pieza' },
  { slug: 'salchichon', es: 'Salchichón', l1: 'salchichon', l2: '', l3: 'pieza' },
  { slug: 'salchichon-de-vic', es: 'Salchichón de Vic', l1: 'salchichon-de-vic', l2: '', l3: 'pieza' },
  { slug: 'sangre', es: 'Sangre', l1: 'sangre', l2: '', l3: 'pieza' },
  { slug: 'secallona', es: 'Secallona', l1: 'secallona', l2: '', l3: 'pieza' },
  { slug: 'sesos', es: 'Sesos', l1: 'sesos', l2: '', l3: 'pieza' },
  { slug: 'sobrasada', es: 'Sobrasada', l1: 'sobrasada', l2: '', l3: 'pieza' },
  { slug: 'solomillo-de-cerdo', es: 'Solomillo de cerdo', l1: 'solomillo-de-cerdo', l2: '', l3: 'pieza' },
  { slug: 'solomillo-de-ternera', es: 'Solomillo de ternera', l1: 'solomillo-de-ternera', l2: '', l3: 'pieza' },
  { slug: 'tapa-de-ternera', es: 'Tapa de ternera', l1: 'tapa-de-ternera', l2: '', l3: 'entero' },
  { slug: 'tapilla-de-ternera', es: 'Tapilla de ternera', l1: 'tapilla-de-ternera', l2: '', l3: 'entero' },
  { slug: 'tocino', es: 'Tocino', l1: 'tocino', l2: '', l3: 'pieza' },
  { slug: 'vacio-de-ternera', es: 'Vacío de ternera', l1: 'vacio-de-ternera', l2: '', l3: 'entero' },
  { slug: 'aleta-de-ternera-filetes', es: 'Aleta de ternera · filetes', l1: 'aleta-de-ternera', l2: '', l3: 'filetes' },
  { slug: 'aleta-de-ternera-troceado', es: 'Aleta de ternera · troceado', l1: 'aleta-de-ternera', l2: '', l3: 'troceado' },
  { slug: 'babilla-de-ternera-filetes', es: 'Babilla de ternera · filetes', l1: 'babilla-de-ternera', l2: '', l3: 'filetes' },
  { slug: 'brazuelo-de-ternera-troceado', es: 'Brazuelo de ternera · troceado', l1: 'brazuelo-de-ternera', l2: '', l3: 'troceado' },
  { slug: 'butifarra-blanca-lonchas', es: 'Butifarra blanca · lonchas', l1: 'butifarra-blanca', l2: '', l3: 'lonchas' },
  { slug: 'butifarra-negra-lonchas', es: 'Butifarra negra · lonchas', l1: 'butifarra-negra', l2: '', l3: 'lonchas' },
  { slug: 'cabecera-de-lomo-filetes', es: 'Cabecera de lomo · filetes', l1: 'cabecera-de-lomo', l2: '', l3: 'filetes' },
  { slug: 'cadera-de-ternera-filetes', es: 'Cadera de ternera · filetes', l1: 'cadera-de-ternera', l2: '', l3: 'filetes' },
  { slug: 'chopped-lonchas', es: 'Chopped · lonchas', l1: 'chopped', l2: '', l3: 'lonchas' },
  { slug: 'chuletero-de-cerdo-troceado', es: 'Chuletero de cerdo · troceado', l1: 'chuletero-de-cerdo', l2: '', l3: 'troceado' },
  { slug: 'ciervo-filetes', es: 'Ciervo · filetes', l1: 'ciervo', l2: '', l3: 'filetes' },
  { slug: 'contra-de-ternera-filetes', es: 'Contra de ternera · filetes', l1: 'contra-de-ternera', l2: '', l3: 'filetes' },
  { slug: 'contramuslo-de-pavo-filetes', es: 'Contramuslo de pavo · filetes', l1: 'contramuslo-de-pavo', l2: '', l3: 'filetes' },
  { slug: 'equino-filetes', es: 'Equino · filetes', l1: 'equino', l2: '', l3: 'filetes' },
  { slug: 'espaldilla-de-ternera-filetes', es: 'Espaldilla de ternera · filetes', l1: 'espaldilla-de-ternera', l2: '', l3: 'filetes' },
  { slug: 'falda-de-cordero-troceado', es: 'Falda de cordero · troceado', l1: 'falda-de-cordero', l2: '', l3: 'troceado' },
  { slug: 'fiambre-de-pavo-lonchas', es: 'Fiambre de pavo · lonchas', l1: 'fiambre-de-pavo', l2: '', l3: 'lonchas' },
  { slug: 'galantina-lonchas', es: 'Galantina · lonchas', l1: 'galantina', l2: '', l3: 'lonchas' },
  { slug: 'gallina-troceado', es: 'Gallina · troceado', l1: 'gallina', l2: '', l3: 'troceado' },
  { slug: 'higado-filetes', es: 'Hígado · filetes', l1: 'higado', l2: '', l3: 'filetes' },
  { slug: 'jabali-troceado', es: 'Jabalí · troceado', l1: 'jabali', l2: '', l3: 'troceado' },
  { slug: 'jamon-cocido-lonchas', es: 'Jamón cocido · lonchas', l1: 'jamon-cocido', l2: '', l3: 'lonchas' },
  { slug: 'jamon-fresco-deshuesado', es: 'Jamón fresco · deshuesado', l1: 'jamon-fresco', l2: '', l3: 'deshuesado' },
  { slug: 'llana-de-ternera-filetes', es: 'Llana de ternera · filetes', l1: 'llana-de-ternera', l2: '', l3: 'filetes' },
  { slug: 'longaniza-lonchas', es: 'Longaniza · lonchas', l1: 'longaniza', l2: '', l3: 'lonchas' },
  { slug: 'morcilla-de-burgos-lonchas', es: 'Morcilla de Burgos · lonchas', l1: 'morcilla-de-burgos', l2: '', l3: 'lonchas' },
  { slug: 'morcon-lonchas', es: 'Morcón · lonchas', l1: 'morcon', l2: '', l3: 'lonchas' },
  { slug: 'mortadela-lonchas', es: 'Mortadela · lonchas', l1: 'mortadela', l2: '', l3: 'lonchas' },
  { slug: 'paleta-cocida-lonchas', es: 'Paleta cocida · lonchas', l1: 'paleta-cocida', l2: '', l3: 'lonchas' },
  { slug: 'paleta-iberica-lonchas', es: 'Paleta ibérica · lonchas', l1: 'paleta-iberica', l2: '', l3: 'lonchas' },
  { slug: 'paleta-serrana-lonchas', es: 'Paleta serrana · lonchas', l1: 'paleta-serrana', l2: '', l3: 'lonchas' },
  { slug: 'paletilla-de-cerdo-deshuesado', es: 'Paletilla de cerdo · deshuesado', l1: 'paletilla-de-cerdo', l2: '', l3: 'deshuesado' },
  { slug: 'paletilla-de-cerdo-troceado', es: 'Paletilla de cerdo · troceado', l1: 'paletilla-de-cerdo', l2: '', l3: 'troceado' },
  { slug: 'papada-curada-lonchas', es: 'Papada curada · lonchas', l1: 'papada-curada', l2: '', l3: 'lonchas' },
  { slug: 'pescuezo-de-ternera-troceado', es: 'Pescuezo de ternera · troceado', l1: 'pescuezo-de-ternera', l2: '', l3: 'troceado' },
  { slug: 'pez-de-ternera-filetes', es: 'Pez de ternera · filetes', l1: 'pez-de-ternera', l2: '', l3: 'filetes' },
  { slug: 'salami-lonchas', es: 'Salami · lonchas', l1: 'salami', l2: '', l3: 'lonchas' },
  { slug: 'salchichon-de-vic-lonchas', es: 'Salchichón de Vic · lonchas', l1: 'salchichon-de-vic', l2: '', l3: 'lonchas' },
  { slug: 'tapa-de-ternera-filetes', es: 'Tapa de ternera · filetes', l1: 'tapa-de-ternera', l2: '', l3: 'filetes' },
  { slug: 'tapilla-de-ternera-filetes', es: 'Tapilla de ternera · filetes', l1: 'tapilla-de-ternera', l2: '', l3: 'filetes' },
  { slug: 'vacio-de-ternera-filetes', es: 'Vacío de ternera · filetes', l1: 'vacio-de-ternera', l2: '', l3: 'filetes' },
  { slug: 'babilla-de-ternera-tacos', es: 'Babilla de ternera · tacos', l1: 'babilla-de-ternera', l2: '', l3: 'tacos' },
  { slug: 'cabecera-de-lomo-tacos', es: 'Cabecera de lomo · tacos', l1: 'cabecera-de-lomo', l2: '', l3: 'tacos' },
  { slug: 'cadera-de-ternera-tacos', es: 'Cadera de ternera · tacos', l1: 'cadera-de-ternera', l2: '', l3: 'tacos' },
  { slug: 'ciervo-tacos', es: 'Ciervo · tacos', l1: 'ciervo', l2: '', l3: 'tacos' },
  { slug: 'espaldilla-de-ternera-tacos', es: 'Espaldilla de ternera · tacos', l1: 'espaldilla-de-ternera', l2: '', l3: 'tacos' },
  { slug: 'pescuezo-de-ternera-picada', es: 'Pescuezo de ternera · picada', l1: 'pescuezo-de-ternera', l2: '', l3: 'picada' },
  { slug: 'tapa-de-ternera-tacos', es: 'Tapa de ternera · tacos', l1: 'tapa-de-ternera', l2: '', l3: 'tacos' },
  /* ── dairy ── */
  { slug: 'burrata', es: 'Burrata', l1: 'burrata', l2: '', l3: 'pieza' },
  { slug: 'cuajada', es: 'Cuajada', l1: 'cuajada', l2: '', l3: 'pieza' },
  { slug: 'huevo', es: 'Huevo', l1: 'huevo', l2: '', l3: 'pieza' },
  { slug: 'leche', es: 'Leche', l1: 'leche', l2: '', l3: 'pieza' },
  { slug: 'mantequilla', es: 'Mantequilla', l1: 'mantequilla', l2: '', l3: 'pieza' },
  { slug: 'margarina', es: 'Margarina', l1: 'margarina', l2: '', l3: 'pieza' },
  { slug: 'nata', es: 'Nata', l1: 'nata', l2: '', l3: 'pieza' },
  { slug: 'postre-lacteo', es: 'Postre lácteo', l1: 'postre-lacteo', l2: '', l3: 'pieza' },
  { slug: 'queso-azul', es: 'Queso azul', l1: 'queso-azul', l2: '', l3: 'pieza' },
  { slug: 'queso-cheddar', es: 'Queso cheddar', l1: 'queso-cheddar', l2: '', l3: 'pieza' },
  { slug: 'queso-crema', es: 'Queso crema', l1: 'queso-crema', l2: '', l3: 'pieza' },
  { slug: 'queso-de-burgos', es: 'Queso de Burgos', l1: 'queso-de-burgos', l2: '', l3: 'pieza' },
  { slug: 'queso-de-cabra', es: 'Queso de cabra', l1: 'queso-de-cabra', l2: '', l3: 'pieza' },
  { slug: 'queso-de-mezcla', es: 'Queso de mezcla', l1: 'queso-de-mezcla', l2: '', l3: 'pieza' },
  { slug: 'queso-de-oveja', es: 'Queso de oveja', l1: 'queso-de-oveja', l2: '', l3: 'pieza' },
  { slug: 'queso-de-vaca', es: 'Queso de vaca', l1: 'queso-de-vaca', l2: '', l3: 'pieza' },
  { slug: 'queso-emmental', es: 'Queso emmental', l1: 'queso-emmental', l2: '', l3: 'pieza' },
  { slug: 'queso-en-lonchas', es: 'Queso en lonchas', l1: 'queso-en-lonchas', l2: '', l3: 'pieza' },
  { slug: 'queso-fresco', es: 'Queso fresco', l1: 'queso-fresco', l2: '', l3: 'pieza' },
  { slug: 'queso-gouda', es: 'Queso gouda', l1: 'queso-gouda', l2: '', l3: 'pieza' },
  { slug: 'queso-idiazabal', es: 'Queso idiazábal', l1: 'queso-idiazabal', l2: '', l3: 'pieza' },
  { slug: 'queso-mahon', es: 'Queso mahón', l1: 'queso-mahon', l2: '', l3: 'pieza' },
  { slug: 'queso-majorero', es: 'Queso majorero', l1: 'queso-majorero', l2: '', l3: 'pieza' },
  { slug: 'queso-manchego', es: 'Queso manchego', l1: 'queso-manchego', l2: '', l3: 'pieza' },
  { slug: 'queso-mozzarella', es: 'Queso mozzarella', l1: 'queso-mozzarella', l2: '', l3: 'pieza' },
  { slug: 'queso-parmesano', es: 'Queso parmesano', l1: 'queso-parmesano', l2: '', l3: 'pieza' },
  { slug: 'queso-rallado', es: 'Queso rallado', l1: 'queso-rallado', l2: '', l3: 'pieza' },
  { slug: 'queso-tetilla', es: 'Queso tetilla', l1: 'queso-tetilla', l2: '', l3: 'pieza' },
  { slug: 'yogur', es: 'Yogur', l1: 'yogur', l2: '', l3: 'pieza' },
  { slug: 'queso-parmesano-rallado', es: 'Queso parmesano · rallado', l1: 'queso-parmesano', l2: '', l3: 'rallado' },
  /* ── fruit ── */
  { slug: 'aguacate-cortado', es: 'Aguacate · cortado', l1: 'aguacate', l2: '', l3: 'cortado' },
  { slug: 'cereza', es: 'Cereza', l1: 'cereza', l2: '', l3: 'entero' },
  { slug: 'ciruela', es: 'Ciruela', l1: 'ciruela', l2: '', l3: 'entero' },
  { slug: 'granada-cortado', es: 'Granada · cortado', l1: 'granada', l2: '', l3: 'cortado' },
  { slug: 'kiwi-cortado', es: 'Kiwi · cortado', l1: 'kiwi', l2: '', l3: 'cortado' },
  { slug: 'limon-cortado', es: 'Limón · cortado', l1: 'limon', l2: '', l3: 'cortado' },
  { slug: 'melon-cantalupo-cortado', es: 'Melón cantalupo · cortado', l1: 'melon', l2: 'melon-cantalupo', l3: 'cortado' },
  { slug: 'melon-cortado', es: 'Melón · cortado', l1: 'melon', l2: '', l3: 'cortado' },
  { slug: 'melon-galia-cortado', es: 'Melón galia · cortado', l1: 'melon', l2: 'melon-galia', l3: 'cortado' },
  { slug: 'melon-piel-de-sapo-cortado', es: 'Melón piel de sapo · cortado', l1: 'melon', l2: 'melon-piel-de-sapo', l3: 'cortado' },
  { slug: 'naranja-cortado', es: 'Naranja · cortado', l1: 'naranja', l2: '', l3: 'cortado' },
  { slug: 'papaya-cortado', es: 'Papaya · cortado', l1: 'papaya', l2: '', l3: 'cortado' },
  { slug: 'pomelo-cortado', es: 'Pomelo · cortado', l1: 'pomelo', l2: '', l3: 'cortado' },
  { slug: 'sandia-cortado', es: 'Sandía · cortado', l1: 'sandia', l2: '', l3: 'cortado' },
  { slug: 'aguacate', es: 'Aguacate', l1: 'aguacate', l2: '', l3: 'entero' },
  { slug: 'albaricoque', es: 'Albaricoque', l1: 'albaricoque', l2: '', l3: 'entero' },
  { slug: 'arandano', es: 'Arándano', l1: 'arandano', l2: '', l3: 'entero' },
  { slug: 'bananito', es: 'Bananito', l1: 'bananito', l2: '', l3: 'entero' },
  { slug: 'breva', es: 'Breva', l1: 'breva', l2: '', l3: 'entero' },
  { slug: 'caqui', es: 'Caqui', l1: 'caqui', l2: '', l3: 'entero' },
  { slug: 'carambola', es: 'Carambola', l1: 'carambola', l2: '', l3: 'entero' },
  { slug: 'castana', es: 'Castaña', l1: 'castana', l2: '', l3: 'entero' },
  { slug: 'chirimoya', es: 'Chirimoya', l1: 'chirimoya', l2: '', l3: 'entero' },
  { slug: 'ciruela-amarilla', es: 'Ciruela amarilla', l1: 'ciruela', l2: 'ciruela-amarilla', l3: 'entero' },
  { slug: 'ciruela-claudia', es: 'Ciruela claudia', l1: 'ciruela', l2: 'ciruela-claudia', l3: 'entero' },
  { slug: 'ciruela-roja', es: 'Ciruela roja', l1: 'ciruela', l2: 'ciruela-roja', l3: 'entero' },
  { slug: 'clementina', es: 'Clementina', l1: 'mandarina', l2: 'clementina', l3: 'entero' },
  { slug: 'coco', es: 'Coco', l1: 'coco', l2: '', l3: 'entero' },
  { slug: 'curuba', es: 'Curuba', l1: 'curuba', l2: '', l3: 'entero' },
  { slug: 'datil', es: 'Dátil', l1: 'datil', l2: '', l3: 'entero' },
  { slug: 'frambuesa', es: 'Frambuesa', l1: 'frambuesa', l2: '', l3: 'entero' },
  { slug: 'fresa', es: 'Fresa', l1: 'fresa', l2: '', l3: 'entero' },
  { slug: 'granada', es: 'Granada', l1: 'granada', l2: '', l3: 'entero' },
  { slug: 'grosella', es: 'Grosella', l1: 'grosella', l2: '', l3: 'entero' },
  { slug: 'guanabana', es: 'Guanábana', l1: 'guanabana', l2: '', l3: 'entero' },
  { slug: 'guayaba', es: 'Guayaba', l1: 'guayaba', l2: '', l3: 'entero' },
  { slug: 'guinda', es: 'Guinda', l1: 'cereza', l2: 'guinda', l3: 'entero' },
  { slug: 'higo', es: 'Higo', l1: 'higo', l2: '', l3: 'entero' },
  { slug: 'higo-chumbo', es: 'Higo chumbo', l1: 'higo-chumbo', l2: '', l3: 'entero' },
  { slug: 'kiwano', es: 'Kiwano', l1: 'kiwano', l2: '', l3: 'entero' },
  { slug: 'kiwi', es: 'Kiwi', l1: 'kiwi', l2: '', l3: 'entero' },
  { slug: 'kumquat', es: 'Kumquat', l1: 'kumquat', l2: '', l3: 'entero' },
  { slug: 'lima', es: 'Lima', l1: 'lima', l2: '', l3: 'entero' },
  { slug: 'limon', es: 'Limón', l1: 'limon', l2: '', l3: 'entero' },
  { slug: 'litchi', es: 'Litchi', l1: 'litchi', l2: '', l3: 'entero' },
  { slug: 'mandarina', es: 'Mandarina', l1: 'mandarina', l2: '', l3: 'entero' },
  { slug: 'mango', es: 'Mango', l1: 'mango', l2: '', l3: 'entero' },
  { slug: 'mangostan', es: 'Mangostán', l1: 'mangostan', l2: '', l3: 'entero' },
  { slug: 'manzana-fuji', es: 'Manzana fuji', l1: 'manzana', l2: 'manzana-fuji', l3: 'entero' },
  { slug: 'manzana-golden', es: 'Manzana golden', l1: 'manzana', l2: 'manzana-golden', l3: 'entero' },
  { slug: 'manzana-granny-smith', es: 'Manzana granny smith', l1: 'manzana', l2: 'manzana-granny-smith', l3: 'entero' },
  { slug: 'manzana-pink-lady', es: 'Manzana pink lady', l1: 'manzana', l2: 'manzana-pink-lady', l3: 'entero' },
  { slug: 'manzana-reineta', es: 'Manzana reineta', l1: 'manzana', l2: 'manzana-reineta', l3: 'entero' },
  { slug: 'manzana-royal-gala', es: 'Manzana royal gala', l1: 'manzana', l2: 'manzana-royal-gala', l3: 'entero' },
  { slug: 'manzana-starking', es: 'Manzana starking', l1: 'manzana', l2: 'manzana-starking', l3: 'entero' },
  { slug: 'manzana-verde-doncella', es: 'Manzana verde doncella', l1: 'manzana', l2: 'manzana-verde-doncella', l3: 'entero' },
  { slug: 'maracuya', es: 'Maracuyá', l1: 'maracuya', l2: '', l3: 'entero' },
  { slug: 'melocoton', es: 'Melocotón', l1: 'melocoton', l2: '', l3: 'entero' },
  { slug: 'melon-cantalupo', es: 'Melón cantalupo', l1: 'melon', l2: 'melon-cantalupo', l3: 'entero' },
  { slug: 'melon-galia', es: 'Melón galia', l1: 'melon', l2: 'melon-galia', l3: 'entero' },
  { slug: 'melon-piel-de-sapo', es: 'Melón piel de sapo', l1: 'melon', l2: 'melon-piel-de-sapo', l3: 'entero' },
  { slug: 'membrillo', es: 'Membrillo', l1: 'membrillo', l2: '', l3: 'entero' },
  { slug: 'mora', es: 'Mora', l1: 'mora', l2: '', l3: 'entero' },
  { slug: 'naranja', es: 'Naranja', l1: 'naranja', l2: '', l3: 'entero' },
  { slug: 'naranja-navelina', es: 'Naranja navelina', l1: 'naranja', l2: 'naranja-navelina', l3: 'entero' },
  { slug: 'naranja-sanguina', es: 'Naranja sanguina', l1: 'naranja', l2: 'naranja-sanguina', l3: 'entero' },
  { slug: 'naranja-valencia-late', es: 'Naranja valencia late', l1: 'naranja', l2: 'naranja-valencia-late', l3: 'entero' },
  { slug: 'nashi', es: 'Nashi', l1: 'nashi', l2: '', l3: 'entero' },
  { slug: 'nectarina', es: 'Nectarina', l1: 'nectarina', l2: '', l3: 'entero' },
  { slug: 'nispero', es: 'Níspero', l1: 'nispero', l2: '', l3: 'entero' },
  { slug: 'papaya', es: 'Papaya', l1: 'papaya', l2: '', l3: 'entero' },
  { slug: 'paraguayo', es: 'Paraguayo', l1: 'paraguayo', l2: '', l3: 'entero' },
  { slug: 'pera-blanquilla', es: 'Pera blanquilla', l1: 'pera', l2: 'pera-blanquilla', l3: 'entero' },
  { slug: 'pera-conferencia', es: 'Pera conferencia', l1: 'pera', l2: 'pera-conferencia', l3: 'entero' },
  { slug: 'pera-ercolina', es: 'Pera ercolina', l1: 'pera', l2: 'pera-ercolina', l3: 'entero' },
  { slug: 'pera-limonera', es: 'Pera limonera', l1: 'pera', l2: 'pera-limonera', l3: 'entero' },
  { slug: 'pera-williams', es: 'Pera williams', l1: 'pera', l2: 'pera-williams', l3: 'entero' },
  { slug: 'physalis', es: 'Physalis', l1: 'physalis', l2: '', l3: 'entero' },
  { slug: 'picota', es: 'Picota', l1: 'cereza', l2: 'picota', l3: 'entero' },
  { slug: 'pina', es: 'Piña', l1: 'pina', l2: '', l3: 'entero' },
  { slug: 'pitahaya', es: 'Pitahaya', l1: 'pitahaya', l2: '', l3: 'entero' },
  { slug: 'platano', es: 'Plátano', l1: 'platano', l2: '', l3: 'entero' },
  { slug: 'pomelo', es: 'Pomelo', l1: 'pomelo', l2: '', l3: 'entero' },
  { slug: 'rambutan', es: 'Rambután', l1: 'rambutan', l2: '', l3: 'entero' },
  { slug: 'sandia', es: 'Sandía', l1: 'sandia', l2: '', l3: 'entero' },
  { slug: 'satsuma', es: 'Satsuma', l1: 'mandarina', l2: 'satsuma', l3: 'entero' },
  { slug: 'sharon', es: 'Sharon', l1: 'sharon', l2: '', l3: 'entero' },
  { slug: 'tamarindo', es: 'Tamarindo', l1: 'tamarindo', l2: '', l3: 'entero' },
  { slug: 'uva-aledo', es: 'Uva aledo', l1: 'uva', l2: 'uva-aledo', l3: 'racimo' },
  { slug: 'uva-blanca', es: 'Uva blanca', l1: 'uva', l2: 'uva-blanca', l3: 'racimo' },
  { slug: 'uva-cardinal', es: 'Uva cardinal', l1: 'uva', l2: 'uva-cardinal', l3: 'racimo' },
  { slug: 'uva-moscatel', es: 'Uva moscatel', l1: 'uva', l2: 'uva-moscatel', l3: 'racimo' },
  { slug: 'uva-negra', es: 'Uva negra', l1: 'uva', l2: 'uva-negra', l3: 'racimo' },
  { slug: 'uva-red-globe', es: 'Uva red globe', l1: 'uva', l2: 'uva-red-globe', l3: 'racimo' },
  { slug: 'zapote', es: 'Zapote', l1: 'zapote', l2: '', l3: 'entero' },
  { slug: 'naranja-navelina-cortado', es: 'Naranja navelina · cortado', l1: 'naranja', l2: 'naranja-navelina', l3: 'cortado' },
  { slug: 'naranja-sanguina-cortado', es: 'Naranja sanguina · cortado', l1: 'naranja', l2: 'naranja-sanguina', l3: 'cortado' },
  { slug: 'naranja-valencia-late-cortado', es: 'Naranja valencia late · cortado', l1: 'naranja', l2: 'naranja-valencia-late', l3: 'cortado' },
  /* ── vegetable ── */
  { slug: 'alcachofa-limpio', es: 'Alcachofa · limpio', l1: 'alcachofa', l2: '', l3: 'limpio' },
  { slug: 'calabaza-cacahuete-cortado', es: 'Calabaza cacahuete · cortado', l1: 'calabaza', l2: 'calabaza-cacahuete', l3: 'cortado' },
  { slug: 'calabaza-cortado', es: 'Calabaza · cortado', l1: 'calabaza', l2: '', l3: 'cortado' },
  { slug: 'acelga', es: 'Acelga', l1: 'acelga', l2: '', l3: 'manojo' },
  { slug: 'achicoria-roja', es: 'Achicoria roja', l1: 'achicoria-roja', l2: '', l3: 'entero' },
  { slug: 'ajo', es: 'Ajo', l1: 'ajo', l2: '', l3: 'entero' },
  { slug: 'ajo-tierno', es: 'Ajo tierno', l1: 'ajo-tierno', l2: '', l3: 'manojo' },
  { slug: 'alcachofa', es: 'Alcachofa', l1: 'alcachofa', l2: '', l3: 'entero' },
  { slug: 'alga-wakame', es: 'Alga wakame', l1: 'alga-wakame', l2: '', l3: 'entero' },
  { slug: 'apio', es: 'Apio', l1: 'apio', l2: '', l3: 'entero' },
  { slug: 'berenjena', es: 'Berenjena', l1: 'berenjena', l2: '', l3: 'entero' },
  { slug: 'berro', es: 'Berro', l1: 'berro', l2: '', l3: 'manojo' },
  { slug: 'boniato', es: 'Boniato', l1: 'boniato', l2: '', l3: 'entero' },
  { slug: 'borraja', es: 'Borraja', l1: 'borraja', l2: '', l3: 'manojo' },
  { slug: 'brocoli', es: 'Brócoli', l1: 'brocoli', l2: '', l3: 'entero' },
  { slug: 'calabacin', es: 'Calabacín', l1: 'calabacin', l2: '', l3: 'entero' },
  { slug: 'calabaza-cacahuete', es: 'Calabaza cacahuete', l1: 'calabaza', l2: 'calabaza-cacahuete', l3: 'entero' },
  { slug: 'calabaza-violin', es: 'Calabaza violín', l1: 'calabaza', l2: 'calabaza-violin', l3: 'entero' },
  { slug: 'calcot', es: 'Calçot', l1: 'calcot', l2: '', l3: 'manojo' },
  { slug: 'canonigos', es: 'Canónigos', l1: 'canonigos', l2: '', l3: 'manojo' },
  { slug: 'cardo', es: 'Cardo', l1: 'cardo', l2: '', l3: 'manojo' },
  { slug: 'cebolla-blanca', es: 'Cebolla blanca', l1: 'cebolla', l2: 'cebolla-blanca', l3: 'entero' },
  { slug: 'cebolla-blanca-dulce', es: 'Cebolla blanca dulce', l1: 'cebolla', l2: 'cebolla-blanca-dulce', l3: 'entero' },
  { slug: 'cebolla-morada', es: 'Cebolla morada', l1: 'cebolla', l2: 'cebolla-morada', l3: 'entero' },
  { slug: 'cebolla-tierna', es: 'Cebolla tierna', l1: 'cebolla', l2: 'cebolla-tierna', l3: 'manojo' },
  { slug: 'cebolleta', es: 'Cebolleta', l1: 'cebolleta', l2: '', l3: 'manojo' },
  { slug: 'chalota', es: 'Chalota', l1: 'chalota', l2: '', l3: 'entero' },
  { slug: 'chirivia', es: 'Chirivía', l1: 'chirivia', l2: '', l3: 'entero' },
  { slug: 'cogollo', es: 'Cogollo', l1: 'lechuga', l2: 'cogollo', l3: 'entero' },
  { slug: 'col', es: 'Col', l1: 'col', l2: '', l3: 'entero' },
  { slug: 'col-rizada', es: 'Col rizada', l1: 'col-rizada', l2: '', l3: 'manojo' },
  { slug: 'coles-de-bruselas', es: 'Coles de Bruselas', l1: 'coles-de-bruselas', l2: '', l3: 'entero' },
  { slug: 'coliflor', es: 'Coliflor', l1: 'coliflor', l2: '', l3: 'entero' },
  { slug: 'colinabo', es: 'Colinabo', l1: 'colinabo', l2: '', l3: 'entero' },
  { slug: 'crema-de-verduras', es: 'Crema de verduras', l1: 'crema-de-verduras', l2: '', l3: 'entero' },
  { slug: 'endibia', es: 'Endibia', l1: 'endibia', l2: '', l3: 'entero' },
  { slug: 'ensalada-preparada', es: 'Ensalada preparada', l1: 'ensalada-preparada', l2: '', l3: 'entero' },
  { slug: 'escarola', es: 'Escarola', l1: 'escarola', l2: '', l3: 'entero' },
  { slug: 'esparrago-blanco', es: 'Espárrago blanco', l1: 'esparrago', l2: 'esparrago-blanco', l3: 'manojo' },
  { slug: 'esparrago-verde', es: 'Espárrago verde', l1: 'esparrago', l2: 'esparrago-verde', l3: 'manojo' },
  { slug: 'espinaca', es: 'Espinaca', l1: 'espinaca', l2: '', l3: 'manojo' },
  { slug: 'garrofon', es: 'Garrofón', l1: 'garrofon', l2: '', l3: 'entero' },
  { slug: 'germinado', es: 'Germinado', l1: 'germinado', l2: '', l3: 'entero' },
  { slug: 'grelo', es: 'Grelo', l1: 'grelo', l2: '', l3: 'manojo' },
  { slug: 'guindilla', es: 'Guindilla', l1: 'guindilla', l2: '', l3: 'entero' },
  { slug: 'guisante', es: 'Guisante', l1: 'guisante', l2: '', l3: 'entero' },
  { slug: 'haba', es: 'Haba', l1: 'haba', l2: '', l3: 'entero' },
  { slug: 'hinojo', es: 'Hinojo', l1: 'hinojo', l2: '', l3: 'entero' },
  { slug: 'jengibre', es: 'Jengibre', l1: 'jengibre', l2: '', l3: 'entero' },
  { slug: 'judia-verde', es: 'Judía verde', l1: 'judia-verde', l2: '', l3: 'manojo' },
  { slug: 'lechuga-batavia', es: 'Lechuga batavia', l1: 'lechuga', l2: 'lechuga-batavia', l3: 'entero' },
  { slug: 'lechuga-hoja-de-roble', es: 'Lechuga hoja de roble', l1: 'lechuga', l2: 'lechuga-hoja-de-roble', l3: 'entero' },
  { slug: 'lechuga-iceberg', es: 'Lechuga iceberg', l1: 'lechuga', l2: 'lechuga-iceberg', l3: 'entero' },
  { slug: 'lechuga-lollo-rosso', es: 'Lechuga lollo rosso', l1: 'lechuga', l2: 'lechuga-lollo-rosso', l3: 'entero' },
  { slug: 'lechuga-romana', es: 'Lechuga romana', l1: 'lechuga', l2: 'lechuga-romana', l3: 'entero' },
  { slug: 'lechuga-trocadero', es: 'Lechuga trocadero', l1: 'lechuga', l2: 'lechuga-trocadero', l3: 'entero' },
  { slug: 'lombarda', es: 'Lombarda', l1: 'lombarda', l2: '', l3: 'entero' },
  { slug: 'maiz', es: 'Maíz', l1: 'maiz', l2: '', l3: 'entero' },
  { slug: 'nabo', es: 'Nabo', l1: 'nabo', l2: '', l3: 'entero' },
  { slug: 'name', es: 'Ñame', l1: 'name', l2: '', l3: 'entero' },
  { slug: 'okra', es: 'Okra', l1: 'okra', l2: '', l3: 'entero' },
  { slug: 'pak-choi', es: 'Pak choi', l1: 'pak-choi', l2: '', l3: 'entero' },
  { slug: 'patata-agria', es: 'Patata agria', l1: 'patata', l2: 'patata-agria', l3: 'entero' },
  { slug: 'patata-kennebec', es: 'Patata kennebec', l1: 'patata', l2: 'patata-kennebec', l3: 'entero' },
  { slug: 'patata-monalisa', es: 'Patata monalisa', l1: 'patata', l2: 'patata-monalisa', l3: 'entero' },
  { slug: 'patata-nueva', es: 'Patata nueva', l1: 'patata', l2: 'patata-nueva', l3: 'entero' },
  { slug: 'patata-roja', es: 'Patata roja', l1: 'patata', l2: 'patata-roja', l3: 'entero' },
  { slug: 'pepino', es: 'Pepino', l1: 'pepino', l2: '', l3: 'entero' },
  { slug: 'pimiento-amarillo', es: 'Pimiento amarillo', l1: 'pimiento', l2: 'pimiento-amarillo', l3: 'entero' },
  { slug: 'pimiento-de-padron', es: 'Pimiento de Padrón', l1: 'pimiento', l2: 'pimiento-de-padron', l3: 'manojo' },
  { slug: 'pimiento-del-piquillo', es: 'Pimiento del piquillo', l1: 'pimiento', l2: 'pimiento-del-piquillo', l3: 'entero' },
  { slug: 'pimiento-lamuyo', es: 'Pimiento lamuyo', l1: 'pimiento', l2: 'pimiento-lamuyo', l3: 'entero' },
  { slug: 'pimiento-rojo', es: 'Pimiento rojo', l1: 'pimiento', l2: 'pimiento-rojo', l3: 'entero' },
  { slug: 'pimiento-verde-italiano', es: 'Pimiento verde italiano', l1: 'pimiento', l2: 'pimiento-verde-italiano', l3: 'entero' },
  { slug: 'puerro', es: 'Puerro', l1: 'puerro', l2: '', l3: 'entero' },
  { slug: 'rabano', es: 'Rábano', l1: 'rabano', l2: '', l3: 'manojo' },
  { slug: 'remolacha', es: 'Remolacha', l1: 'remolacha', l2: '', l3: 'entero' },
  { slug: 'romanesco', es: 'Romanesco', l1: 'romanesco', l2: '', l3: 'entero' },
  { slug: 'rucula', es: 'Rúcula', l1: 'rucula', l2: '', l3: 'manojo' },
  { slug: 'sofrito', es: 'Sofrito', l1: 'sofrito', l2: '', l3: 'entero' },
  { slug: 'tirabeque', es: 'Tirabeque', l1: 'tirabeque', l2: '', l3: 'entero' },
  { slug: 'tomate-cherry', es: 'Tomate cherry', l1: 'tomate', l2: 'tomate-cherry', l3: 'racimo' },
  { slug: 'tomate-corazon-de-buey', es: 'Tomate corazón de buey', l1: 'tomate', l2: 'tomate-corazon-de-buey', l3: 'entero' },
  { slug: 'tomate-de-pera', es: 'Tomate de pera', l1: 'tomate', l2: 'tomate-de-pera', l3: 'entero' },
  { slug: 'tomate-kumato', es: 'Tomate kumato', l1: 'tomate', l2: 'tomate-kumato', l3: 'entero' },
  { slug: 'tomate-raf', es: 'Tomate raf', l1: 'tomate', l2: 'tomate-raf', l3: 'entero' },
  { slug: 'tomate-rama', es: 'Tomate rama', l1: 'tomate', l2: 'tomate-rama', l3: 'racimo' },
  { slug: 'tomate-rosa', es: 'Tomate rosa', l1: 'tomate', l2: 'tomate-rosa', l3: 'entero' },
  { slug: 'tupinambo', es: 'Tupinambo', l1: 'tupinambo', l2: '', l3: 'entero' },
  { slug: 'yuca', es: 'Yuca', l1: 'yuca', l2: '', l3: 'entero' },
  { slug: 'zanahoria', es: 'Zanahoria', l1: 'zanahoria', l2: '', l3: 'entero' },
  /* ── herb-fungus ── */
  { slug: 'boletus-laminado', es: 'Boletus · laminado', l1: 'boletus', l2: '', l3: 'laminado' },
  { slug: 'champinon-laminado', es: 'Champiñón · laminado', l1: 'champinon', l2: '', l3: 'laminado' },
  { slug: 'trufa-negra', es: 'Trufa negra', l1: 'trufa-negra', l2: '', l3: 'entero' },
  { slug: 'albahaca', es: 'Albahaca', l1: 'albahaca', l2: '', l3: 'manojo' },
  { slug: 'boletus', es: 'Boletus', l1: 'boletus', l2: '', l3: 'entero' },
  { slug: 'cebollino', es: 'Cebollino', l1: 'cebollino', l2: '', l3: 'manojo' },
  { slug: 'champinon', es: 'Champiñón', l1: 'champinon', l2: '', l3: 'entero' },
  { slug: 'cilantro', es: 'Cilantro', l1: 'cilantro', l2: '', l3: 'manojo' },
  { slug: 'colmenilla', es: 'Colmenilla', l1: 'colmenilla', l2: '', l3: 'entero' },
  { slug: 'eneldo', es: 'Eneldo', l1: 'eneldo', l2: '', l3: 'manojo' },
  { slug: 'laurel', es: 'Laurel', l1: 'laurel', l2: '', l3: 'manojo' },
  { slug: 'menta', es: 'Menta', l1: 'menta', l2: '', l3: 'manojo' },
  { slug: 'niscalo', es: 'Níscalo', l1: 'niscalo', l2: '', l3: 'entero' },
  { slug: 'oregano', es: 'Orégano', l1: 'oregano', l2: '', l3: 'manojo' },
  { slug: 'perejil', es: 'Perejil', l1: 'perejil', l2: '', l3: 'manojo' },
  { slug: 'rebozuelo', es: 'Rebozuelo', l1: 'rebozuelo', l2: '', l3: 'entero' },
  { slug: 'romero', es: 'Romero', l1: 'romero', l2: '', l3: 'manojo' },
  { slug: 'salvia', es: 'Salvia', l1: 'salvia', l2: '', l3: 'manojo' },
  { slug: 'seta', es: 'Seta', l1: 'seta', l2: '', l3: 'entero' },
  { slug: 'seta-de-ostra', es: 'Seta de ostra', l1: 'seta-de-ostra', l2: '', l3: 'entero' },
  { slug: 'shiitake', es: 'Shiitake', l1: 'shiitake', l2: '', l3: 'entero' },
  { slug: 'tomillo', es: 'Tomillo', l1: 'tomillo', l2: '', l3: 'manojo' },
  /* ── pantry ── */
  { slug: 'aceite-de-girasol', es: 'Aceite de girasol', l1: 'aceite-de-girasol', l2: '', l3: 'pieza' },
  { slug: 'aceite-de-oliva', es: 'Aceite de oliva', l1: 'aceite-de-oliva', l2: '', l3: 'pieza' },
  { slug: 'aceite-de-oliva-suave', es: 'Aceite de oliva suave', l1: 'aceite-de-oliva-suave', l2: '', l3: 'pieza' },
  { slug: 'aceite-de-oliva-virgen', es: 'Aceite de oliva virgen', l1: 'aceite-de-oliva-virgen', l2: '', l3: 'pieza' },
  { slug: 'aceite-de-oliva-virgen-extra', es: 'Aceite de oliva virgen extra', l1: 'aceite-de-oliva-virgen-extra', l2: '', l3: 'pieza' },
  { slug: 'aceite-de-orujo-de-oliva', es: 'Aceite de orujo de oliva', l1: 'aceite-de-orujo-de-oliva', l2: '', l3: 'pieza' },
  { slug: 'aceite-de-semillas', es: 'Aceite de semillas', l1: 'aceite-de-semillas', l2: '', l3: 'pieza' },
  { slug: 'aceituna', es: 'Aceituna', l1: 'aceituna', l2: '', l3: 'pieza' },
  { slug: 'aceituna-arbequina', es: 'Aceituna arbequina', l1: 'aceituna-arbequina', l2: '', l3: 'pieza' },
  { slug: 'aceituna-gordal', es: 'Aceituna gordal', l1: 'aceituna-gordal', l2: '', l3: 'pieza' },
  { slug: 'aceituna-manzanilla', es: 'Aceituna manzanilla', l1: 'aceituna-manzanilla', l2: '', l3: 'pieza' },
  { slug: 'aceituna-negra', es: 'Aceituna negra', l1: 'aceituna-negra', l2: '', l3: 'pieza' },
  { slug: 'aceituna-rellena', es: 'Aceituna rellena', l1: 'aceituna-rellena', l2: '', l3: 'pieza' },
  { slug: 'agua', es: 'Agua', l1: 'agua', l2: '', l3: 'pieza' },
  { slug: 'almendra', es: 'Almendra', l1: 'almendra', l2: '', l3: 'pieza' },
  { slug: 'alubia', es: 'Alubia', l1: 'alubia', l2: '', l3: 'pieza' },
  { slug: 'alubia-blanca', es: 'Alubia blanca', l1: 'alubia-blanca', l2: '', l3: 'pieza' },
  { slug: 'alubia-negra', es: 'Alubia negra', l1: 'alubia-negra', l2: '', l3: 'pieza' },
  { slug: 'alubia-pinta', es: 'Alubia pinta', l1: 'alubia-pinta', l2: '', l3: 'pieza' },
  { slug: 'arroz', es: 'Arroz', l1: 'arroz', l2: '', l3: 'pieza' },
  { slug: 'arroz-bomba', es: 'Arroz bomba', l1: 'arroz-bomba', l2: '', l3: 'pieza' },
  { slug: 'arroz-integral', es: 'Arroz integral', l1: 'arroz-integral', l2: '', l3: 'pieza' },
  { slug: 'arroz-largo', es: 'Arroz largo', l1: 'arroz-largo', l2: '', l3: 'pieza' },
  { slug: 'arroz-redondo', es: 'Arroz redondo', l1: 'arroz-redondo', l2: '', l3: 'pieza' },
  { slug: 'avellana', es: 'Avellana', l1: 'avellana', l2: '', l3: 'pieza' },
  { slug: 'azucar', es: 'Azúcar', l1: 'azucar', l2: '', l3: 'pieza' },
  { slug: 'biscote', es: 'Biscote', l1: 'biscote', l2: '', l3: 'pieza' },
  { slug: 'bolleria', es: 'Bollería', l1: 'bolleria', l2: '', l3: 'pieza' },
  { slug: 'cacahuete', es: 'Cacahuete', l1: 'cacahuete', l2: '', l3: 'pieza' },
  { slug: 'cafe', es: 'Café', l1: 'cafe', l2: '', l3: 'pieza' },
  { slug: 'caldo', es: 'Caldo', l1: 'caldo', l2: '', l3: 'pieza' },
  { slug: 'cerveza', es: 'Cerveza', l1: 'cerveza', l2: '', l3: 'pieza' },
  { slug: 'chocolate', es: 'Chocolate', l1: 'chocolate', l2: '', l3: 'pieza' },
  { slug: 'conserva-carnica', es: 'Conserva cárnica', l1: 'conserva-carnica', l2: '', l3: 'pieza' },
  { slug: 'conserva-de-pescado', es: 'Conserva de pescado', l1: 'conserva-de-pescado', l2: '', l3: 'pieza' },
  { slug: 'conserva-vegetal', es: 'Conserva vegetal', l1: 'conserva-vegetal', l2: '', l3: 'pieza' },
  { slug: 'croqueta', es: 'Croqueta', l1: 'croqueta', l2: '', l3: 'pieza' },
  { slug: 'encurtido', es: 'Encurtido', l1: 'encurtido', l2: '', l3: 'pieza' },
  { slug: 'especia', es: 'Especia', l1: 'especia', l2: '', l3: 'pieza' },
  { slug: 'fruto-seco', es: 'Fruto seco', l1: 'fruto-seco', l2: '', l3: 'pieza' },
  { slug: 'galleta', es: 'Galleta', l1: 'galleta', l2: '', l3: 'pieza' },
  { slug: 'garbanzo', es: 'Garbanzo', l1: 'garbanzo', l2: '', l3: 'pieza' },
  { slug: 'garbanzo-castellano', es: 'Garbanzo castellano', l1: 'garbanzo-castellano', l2: '', l3: 'pieza' },
  { slug: 'garbanzo-lechoso', es: 'Garbanzo lechoso', l1: 'garbanzo-lechoso', l2: '', l3: 'pieza' },
  { slug: 'garbanzo-pedrosillano', es: 'Garbanzo pedrosillano', l1: 'garbanzo-pedrosillano', l2: '', l3: 'pieza' },
  { slug: 'harina', es: 'Harina', l1: 'harina', l2: '', l3: 'pieza' },
  { slug: 'hielo', es: 'Hielo', l1: 'hielo', l2: '', l3: 'pieza' },
  { slug: 'infusion', es: 'Infusión', l1: 'infusion', l2: '', l3: 'pieza' },
  { slug: 'lenteja', es: 'Lenteja', l1: 'lenteja', l2: '', l3: 'pieza' },
  { slug: 'lenteja-beluga', es: 'Lenteja beluga', l1: 'lenteja-beluga', l2: '', l3: 'pieza' },
  { slug: 'lenteja-castellana', es: 'Lenteja castellana', l1: 'lenteja-castellana', l2: '', l3: 'pieza' },
  { slug: 'lenteja-pardina', es: 'Lenteja pardina', l1: 'lenteja-pardina', l2: '', l3: 'pieza' },
  { slug: 'licor', es: 'Licor', l1: 'licor', l2: '', l3: 'pieza' },
  { slug: 'mermelada', es: 'Mermelada', l1: 'mermelada', l2: '', l3: 'pieza' },
  { slug: 'miel', es: 'Miel', l1: 'miel', l2: '', l3: 'pieza' },
  { slug: 'nuez', es: 'Nuez', l1: 'nuez', l2: '', l3: 'pieza' },
  { slug: 'pan', es: 'Pan', l1: 'pan', l2: '', l3: 'pieza' },
  { slug: 'pan-rallado', es: 'Pan rallado', l1: 'pan-rallado', l2: '', l3: 'pieza' },
  { slug: 'pasta', es: 'Pasta', l1: 'pasta', l2: '', l3: 'pieza' },
  { slug: 'picos', es: 'Picos', l1: 'picos', l2: '', l3: 'pieza' },
  { slug: 'pistacho', es: 'Pistacho', l1: 'pistacho', l2: '', l3: 'pieza' },
  { slug: 'pizza', es: 'Pizza', l1: 'pizza', l2: '', l3: 'pieza' },
  { slug: 'plato-preparado', es: 'Plato preparado', l1: 'plato-preparado', l2: '', l3: 'pieza' },
  { slug: 'precocinados-carnico', es: 'Precocinados cárnico', l1: 'precocinados-carnico', l2: '', l3: 'pieza' },
  { slug: 'precocinados-de-pescado', es: 'Precocinados de pescado', l1: 'precocinados-de-pescado', l2: '', l3: 'pieza' },
  { slug: 'refresco', es: 'Refresco', l1: 'refresco', l2: '', l3: 'pieza' },
  { slug: 'sal', es: 'Sal', l1: 'sal', l2: '', l3: 'pieza' },
  { slug: 'salsa', es: 'Salsa', l1: 'salsa', l2: '', l3: 'pieza' },
  { slug: 'semola', es: 'Sémola', l1: 'semola', l2: '', l3: 'pieza' },
  { slug: 'sopa-preparada', es: 'Sopa preparada', l1: 'sopa-preparada', l2: '', l3: 'pieza' },
  { slug: 'tripa-natural', es: 'Tripa natural', l1: 'tripa-natural', l2: '', l3: 'pieza' },
  { slug: 'vinagre', es: 'Vinagre', l1: 'vinagre', l2: '', l3: 'pieza' },
  { slug: 'vino', es: 'Vino', l1: 'vino', l2: '', l3: 'pieza' },
  { slug: 'zumo', es: 'Zumo', l1: 'zumo', l2: '', l3: 'pieza' },
  /* ── category ── */
  { slug: 'aceites-y-grasas', es: 'Aceites y grasas', l1: 'aceites-y-grasas', l2: '', l3: 'pieza', cat: 1 },
  { slug: 'algas', es: 'Algas', l1: 'algas', l2: '', l3: 'pieza', cat: 1 },
  { slug: 'ambiente-y-secos', es: 'Ambiente y secos', l1: 'ambiente-y-secos', l2: '', l3: 'pieza', cat: 1 },
  { slug: 'aves', es: 'Aves', l1: 'aves', l2: '', l3: 'pieza', cat: 1 },
  { slug: 'bebidas', es: 'Bebidas', l1: 'bebidas', l2: '', l3: 'pieza', cat: 1 },
  { slug: 'carne', es: 'Carne', l1: 'carne', l2: '', l3: 'pieza', cat: 1 },
  { slug: 'caza-y-otras-carnes', es: 'Caza y otras carnes', l1: 'caza-y-otras-carnes', l2: '', l3: 'pieza', cat: 1 },
  { slug: 'cefalopodos', es: 'Cefalópodos', l1: 'cefalopodos', l2: '', l3: 'pieza', cat: 1 },
  { slug: 'cerdo', es: 'Cerdo', l1: 'cerdo', l2: '', l3: 'pieza', cat: 1 },
  { slug: 'citricos', es: 'Cítricos', l1: 'citricos', l2: '', l3: 'pieza', cat: 1 },
  { slug: 'cocidos-y-fiambres', es: 'Cocidos y fiambres', l1: 'cocidos-y-fiambres', l2: '', l3: 'pieza', cat: 1 },
  { slug: 'conejo', es: 'Conejo', l1: 'conejo', l2: '', l3: 'pieza', cat: 1 },
  { slug: 'conservas-y-encurtidos', es: 'Conservas y encurtidos', l1: 'conservas-y-encurtidos', l2: '', l3: 'pieza', cat: 1 },
  { slug: 'cordero-y-cabrito', es: 'Cordero y cabrito', l1: 'cordero-y-cabrito', l2: '', l3: 'pieza', cat: 1 },
  { slug: 'curados', es: 'Curados', l1: 'curados', l2: '', l3: 'pieza', cat: 1 },
  { slug: 'despensa', es: 'Despensa', l1: 'despensa', l2: '', l3: 'pieza', cat: 1 },
  { slug: 'embutido', es: 'Embutido', l1: 'embutido', l2: '', l3: 'pieza', cat: 1 },
  { slug: 'fruta', es: 'Fruta', l1: 'fruta', l2: '', l3: 'pieza', cat: 1 },
  { slug: 'fruta-y-verdura', es: 'Fruta y verdura', l1: 'fruta-y-verdura', l2: '', l3: 'pieza', cat: 1 },
  { slug: 'hierbas', es: 'Hierbas', l1: 'hierbas', l2: '', l3: 'pieza', cat: 1 },
  { slug: 'lacteos', es: 'Lácteos', l1: 'lacteos', l2: '', l3: 'pieza', cat: 1 },
  { slug: 'leche-y-nata', es: 'Leche y nata', l1: 'leche-y-nata', l2: '', l3: 'pieza', cat: 1 },
  { slug: 'legumbre-y-arroz', es: 'Legumbre y arroz', l1: 'legumbre-y-arroz', l2: '', l3: 'pieza', cat: 1 },
  { slug: 'mantequillas-y-grasas-lacteas', es: 'Mantequillas y grasas lácteas', l1: 'mantequillas-y-grasas-lacteas', l2: '', l3: 'pieza', cat: 1 },
  { slug: 'marisco', es: 'Marisco', l1: 'marisco', l2: '', l3: 'pieza', cat: 1 },
  { slug: 'marisco-de-concha', es: 'Marisco de concha', l1: 'marisco-de-concha', l2: '', l3: 'pieza', cat: 1 },
  { slug: 'marisco-y-cefalopodos', es: 'Marisco y cefalópodos', l1: 'combo-marisco-cefalopodos', l2: '', l3: 'pieza', cat: 1, combo: 1 },
  { slug: 'panaderia-y-bolleria', es: 'Panadería y bollería', l1: 'panaderia-y-bolleria', l2: '', l3: 'pieza', cat: 1 },
  { slug: 'pasta-y-harinas', es: 'Pasta y harinas', l1: 'pasta-y-harinas', l2: '', l3: 'pieza', cat: 1 },
  { slug: 'pavo', es: 'Pavo', l1: 'pavo', l2: '', l3: 'pieza', cat: 1 },
  { slug: 'pescado-azul', es: 'Pescado azul', l1: 'pescado-azul', l2: '', l3: 'pieza', cat: 1 },
  { slug: 'pescado-blanco', es: 'Pescado blanco', l1: 'pescado-blanco', l2: '', l3: 'pieza', cat: 1 },
  { slug: 'pescado-de-crianza', es: 'Pescado de crianza', l1: 'pescado-de-crianza', l2: '', l3: 'pieza', cat: 1 },
  { slug: 'pescado-y-marisco', es: 'Pescado y marisco', l1: 'pescado-y-marisco', l2: '', l3: 'pieza', cat: 1 },
  { slug: 'queso', es: 'Queso', l1: 'queso', l2: '', l3: 'pieza', cat: 1 },
  { slug: 'raices-y-tuberculos', es: 'Raíces y tubérculos', l1: 'raices-y-tuberculos', l2: '', l3: 'pieza', cat: 1 },
  { slug: 'setas', es: 'Setas', l1: 'setas', l2: '', l3: 'pieza', cat: 1 },
  { slug: 'tripas-y-grasas', es: 'Tripas y grasas', l1: 'tripas-y-grasas', l2: '', l3: 'pieza', cat: 1 },
  { slug: 'vacuno', es: 'Vacuno', l1: 'vacuno', l2: '', l3: 'pieza', cat: 1 },
  { slug: 'verdura', es: 'Verdura', l1: 'verdura', l2: '', l3: 'pieza', cat: 1 },
  { slug: 'yogures-y-postres', es: 'Yogures y postres', l1: 'yogures-y-postres', l2: '', l3: 'pieza', cat: 1 },
];

const fold = (s: string): string =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/* The illustration library uses trade-standard names; a tenant may use another correct local
 * name. These aliases resolve only a picture. They never create, classify, or enroll a SKU in a
 * tenant catalogue. Both targets are indexed files in library/paintings/set/. */
const PAINTING_ALIASES: Array<[string, string]> = [
  ['camote', 'boniato'],
  ['cangrejo', 'necora'],
];

const PRODUCTS = PAINTINGS.filter((p) => !p.cat && !p.combo);
const FACES = PAINTINGS.filter((p) => p.cat && !p.combo);

const visualKey = (v: string) => fold(v).replace(/[·—–_-]/g, ' ').replace(/\s+/g, ' ').trim();

/* A KEY IS A LIST OF WORDS, AND THE NAME IS WHERE THEY ARE FOUND (E197.24).
 *
 * The library keys a row by its SLUG WORDS — `pez-espada`, `patata-monalisa`, `ancas-de-rana` —
 * and a hyphen is a character nobody writing a delivery note ever types. So `n.includes('pez-espada')`
 * could never be true of «Pez espada en rodajas», and a two-word variety carried as one hyphenated
 * key was invisible to the sort rung and to the kind rung both. Reading the key as its WORDS finds
 * it: every word present in the name, in any order, is the key said.
 *
 * IT WIDENS ONLY WHAT WAS BLIND. A one-word key is answered by the plain substring test exactly as
 * before, so `patata`, `merluza` and `carne` behave to the character; the word walk runs only for a
 * key that carries more than one word, which is the only shape the old test could never see. */
const said = (key: string, n: string): boolean => {
  const folded = fold(key);
  if (!folded) return false;
  if (n.includes(folded)) return true;
  const parts = folded.split(/[^a-z0-9]+/).filter(Boolean);
  return parts.length > 1 && parts.every((word) => n.includes(word));
};

/* A KIND THE LIBRARY HOLDS ONLY AS ITS VARIETIES — reviewed one at a time, never derived.
 *
 * «Jamón al corte» names a cured ham and the way it is sold. The library paints serrano, ibérico,
 * cocido and fresco, and holds no plain «Jamón», so the row stood without a face.
 *
 * THE STANDING RULE IS THAT A PICTURE MAY SAY LESS THAN THE NAME AND NEVER SOMETHING ELSE. The
 * cured leg says «a cured ham» — what the house wrote — and stops there. «Patata agria» for a
 * monalisa would say another variety, which is a different sentence, and that is why this map holds
 * the ham and the potato keeps its drawn mark until its own tile is painted.
 *
 * DERIVING THIS RUNG WOULD PAINT THE WRONG HAM. A fallback on the first word of `l1` gathers the
 * eight rows under «jamon» and picks by name, and the plainest name there is «Jamón cocido» — pink
 * deli ham for a cured leg. The kind a house means is evidence, so it is written down and looked at.
 * §16.1 step 1 names `jamon-serrano` as this subject's own reference. */
const KIND_STANDS_FOR = new Map<string, string>([
  [visualKey('Jamón al corte'), 'jamon-serrano'],
]);

/* AN INDEXED FILE CAN STILL FAIL VISUAL REVIEW, AND THE DEBT IS THE TILE'S, NOT THE NAME'S.
 * `patata-monalisa.webp` came back a Mona-Lisa portrait wearing a potato's colours. Holding the
 * SLUG out — rather than the one name that asked for it — keeps the portrait out of every seat that
 * resolves to that file: the SKU's face, the writing line, and the `illustration` column
 * `catalogue-export.tsx` writes into the sheet a tenant sends its customers. A suppressed hit
 * answers with the drawn mark rather than walking on to a neighbouring variety, because a picture
 * of another variety is the very thing the review refused.
 *
 * THE SET IS EMPTY BECAUSE THE REPAINT LANDED (E197.25). `patata-monalisa.webp` is a potato now —
 * an oval tuber, pale-yellow skin, shallow eyes — painted from `patata-agria` by the road in
 * THE-PRODUCT-SHEET-SPEC §16.1 and looked at beside its siblings, so every seat draws it again.
 * The machinery stays: a refusal is one line here, and `baseweb/tools/test-painting-map.mjs` holds
 * the property over whatever this set contains — none, one, or ten. */
const SUPPRESSED_PAINTINGS = new Set<string>([]);

/** The painting this name would wear if it were not held out at review — so a gate can name the
 *  debt («painted and refused») instead of reporting it as «nothing painted». */
export function suppressedPaintingFor(name: string): string | null {
  const row = PRODUCTS.find((p) => visualKey(p.es) === visualKey(name) || visualKey(p.slug) === visualKey(name));
  return row && SUPPRESSED_PAINTINGS.has(row.slug) ? `/paintings/${row.slug}.webp` : null;
}

export function paintingFor(name: string): string | null {
  const written = fold(name);
  const alias = PAINTING_ALIASES.find(([from]) => written.includes(from));
  const n = alias ? written.replace(alias[0], alias[1]) : written;

  /* A REVIEWED BINDING OUTRANKS EVERY DERIVED ONE, so the word resolves to the same painting the
     SKU's own face wears. One answer per subject, whichever surface asks. */
  const reviewed = KIND_STANDS_FOR.get(visualKey(n));
  if (reviewed) return `/paintings/${reviewed}.webp`;
  /* THE WORDS OF A KEY MUST SIT TOGETHER, AND THEN THE LONGEST MATCH WINS.
     Longest first (the never-surprised exam caught «PECHUGA DE PAVO ASADA» wearing the whole-turkey
     painting because first-in-array beat the longer «pechuga de pavo» — array order is not a
     matching rule). Length alone stops being enough the moment a rung reads a key as WORDS, because
     words can be said anywhere: «Pierna de cordero con rinonada sin jarrete» carries every word of
     «Jarrete de cordero» scattered across it, that name is one character the longer, and the phrase
     that says twice it is a LEG was handed a shank.
     So a match is measured by how tightly the key's words are packed where they were found — the
     span they cover, over the length of the key. A key said in one piece measures 1; «Pierna de
     cordero» is said in one piece and wins, while the scattered «Jarrete de cordero» spans thirty
     characters to say eighteen. A slug says its own row's words tighter than the row's kind does,
     which is how `abadejo-lomos` stops wearing the plain abadejo. */
  const spread = (p: Painting): number => {
    const key = fold(p.es);
    if (!key) return Number.POSITIVE_INFINITY;
    if (n.includes(key)) return 1;
    let first = n.length;
    let last = 0;
    for (const word of key.split(/[^a-z0-9]+/).filter(Boolean)) {
      const found = n.indexOf(word);
      if (found < 0) return Number.POSITIVE_INFINITY;
      first = Math.min(first, found);
      last = Math.max(last, found + word.length);
    }
    return (last - first) / key.length;
  };
  const longest = (hits: Painting[]): Painting | undefined =>
    hits.sort((a, b) => spread(a) - spread(b) || fold(b.es).length - fold(a.es).length)[0];

  /* A PRODUCT ALWAYS OUTRANKS A SHELF at the same rung. «Carne picada de ternera» contains
     «carne», and the beef category's face is a cow in a pasture — a real answer for the shelf
     and a wrong one for a tray of mince. */
  const rung = (fn: (set: Painting[]) => Painting | undefined): Painting | undefined =>
    fn(PRODUCTS) ?? fn(FACES);

  /* THE LAST RUNG IS THE KIND, SO IT ANSWERS WITH THE KIND. Falling back on l1 alone, every
     variety of that kind ties, and `longest` then hands back the most specific NAME — «Manzana
     starking argentina» was answered with a granny smith, which is a green apple for a red one.
     A kind-level row (no l2) wins outright; where the kind exists only as its varieties, the
     plainest name is the least wrong stand-in. */
  const kindly = (hits: Painting[]): Painting | undefined => {
    const plain = hits.filter((p) => !p.l2);
    return (plain.length ? plain : hits).sort(
      (a, b) => fold(a.es).length - fold(b.es).length,
    )[0];
  };

  /* THE OTHER DIRECTION IS WORDS TOO (E197.25). This rung answers the SHORTER word — somebody
     writes «gamba» and the library's own name is longer — so it looks for the written word inside
     the library's name. It looked for characters, and «lisa», which is a mullet, was answered with
     «Patata monalisa», which is a potato, on four letters that sit in the middle of «monalisa».
     THE SUPPRESSION WAS HIDING IT: while the potato's tile stood refused this rung's answer was
     dropped by slug, and repainting the tile handed the mullet a potato. A fragment now has to
     begin and end where a word does, which is the same law E197.24 wrote for the other direction. */
  const fragmentOf = (key: string, written: string): boolean => {
    const edge = (character: string | undefined) => character === undefined || !/[a-z0-9]/.test(character);
    for (let at = key.indexOf(written); at !== -1; at = key.indexOf(written, at + 1)) {
      if (edge(key[at - 1]) && edge(key[at + written.length])) return true;
    }
    return false;
  };

  const hit =
    rung((s) => s.find((p) => fold(p.es) === n)) ??
    rung((s) => longest(s.filter((p) => p.l2 && said(p.l2, n) && said(p.l1, n)))) ??
    rung((s) => longest(s.filter((p) => said(p.es, n)))) ??
    rung((s) => longest(s.filter((p) => fragmentOf(fold(p.es), n) && n.length > 3))) ??
    rung((s) => kindly(s.filter((p) => said(p.l1, n))));
  return hit && !SUPPRESSED_PAINTINGS.has(hit.slug) ? `/paintings/${hit.slug}.webp` : null;
}


/* These are deliberate, exact product-name bindings reviewed against a packaged subject. They are
 * not a matching heuristic: a qualifier may be removed only when it changes neither the pictured
 * subject nor its form. An unreviewed variety or cut falls through to the honest drawn mark. */
const CURATED_EXACT_SKU_ALIASES = new Map<string, string>([
  [visualKey('Gamba roja de Palamós'), visualKey('Gamba roja')],
  /* THE FROZEN PRAWN HAS ITS OWN PAINTING NOW (E197.25), so the reviewed variation reaches it by
   * name. The line drops «de Palamós», which is where the prawn came from and not what it looks
   * like, and reads «congelada» as the library's «congelado» — the same state word agreeing with
   * «gamba» instead of with the library's form key. The subject and its form are the same painting
   * either way, which is the only thing this map may drop a qualifier for. Folding gender in
   * `visualKey` would widen every key in the library at once, and a rung is widened one measured
   * step at a time; a reviewed line is the instrument for one binding somebody looked at. */
  [visualKey('Gamba roja de Palamós · congelada'), visualKey('Gamba roja · congelado')],
  [visualKey('Lubina de estero'), visualKey('Lubina')],
  [visualKey('Pollo entero'), visualKey('Pollo')],
  [visualKey('Mango de barco'), visualKey('Mango')],
  [visualKey('Aguacate Hass'), visualKey('Aguacate')],
  /* Supplier grade and pack words do not change the pictured whole produce. These two exact
   * identities are the only evidenced Carlos/Sitjar rows in the Kit fixture (PMR2 and CEG), so
   * bind the reviewed paintings here instead of letting them fall through to the dry-goods mark. */
  [visualKey('PIMIENTO ROJO 1ª'), visualKey('Pimiento rojo')],
  [visualKey('CEBOLLA SACO 25KG'), visualKey('Cebolla blanca')],
]);

// Catalogue renders hundreds of faces: normalize the library once, not once per row and keystroke.
const EXACT_PAINTINGS = new Map(PRODUCTS.flatMap((p) => [
  [visualKey(p.es), `/paintings/${p.slug}.webp`], [visualKey(p.slug), `/paintings/${p.slug}.webp`],
] as Array<[string, string]>));
/** Exact visual evidence only. A related family painting is not this SKU's approved artwork.
 *  A reviewed kind binding is evidence too — it is read after the exact name and its aliases, so a
 *  SKU that names its variety always wears its own painting rather than the kind's. */
export function exactPaintingFor(name: string): string | null {
  let key = visualKey(name);
  for (const [alias, target] of PAINTING_ALIASES) if (key === alias) key = target;
  const kind = KIND_STANDS_FOR.get(key);
  const painting = EXACT_PAINTINGS.get(CURATED_EXACT_SKU_ALIASES.get(key) ?? key)
    ?? (kind ? `/paintings/${kind}.webp` : null);
  if (!painting) return null;
  return SUPPRESSED_PAINTINGS.has(painting.slice('/paintings/'.length, -'.webp'.length)) ? null : painting;
}
