import { Router } from 'express';

const router = Router();
const RELEASE_REPO = process.env.UPDATE_GITHUB_REPO || 'FMG18/waslha-frontend';
const GITHUB_API = `https://api.github.com/repos/${RELEASE_REPO}/releases/latest`;

const assetForAbi = (assets, abi) => {
  const normalized = String(abi || '').toLowerCase();
  const wanted = normalized === 'arm64-v8a' ? 'arm64-v8a'
    : normalized === 'armeabi-v7a' ? 'armeabi-v7a'
    : normalized === 'x86_64' ? 'x86_64'
    : 'universal';

  const exact = assets.find((asset) => asset.name.includes(wanted) && asset.name.endsWith('.apk'));
  if (exact) return exact;
  return assets.find((asset) => asset.name.includes('universal') && asset.name.endsWith('.apk'))
    || assets.find((asset) => asset.name.endsWith('.apk'))
    || null;
};

const checksumFor = (assets, apkName) => {
  if (!apkName) return null;
  return assets.find((asset) => asset.name === `${apkName}.sha256`)
    || assets.find((asset) => asset.name === `${apkName}.sha256.txt`)
    || null;
};

router.get('/', async (req, res, next) => {
  try {
    const currentCode = Number(req.query.currentCode || 0);
    const abi = String(req.query.abi || 'universal');
    const response = await fetch(GITHUB_API, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'Waslha-Updater'
      }
    });

    if (response.status === 404) {
      return res.json({ success: true, data: { updateAvailable: false, reason: 'no-release' } });
    }
    if (!response.ok) throw new Error(`GitHub release lookup failed: ${response.status}`);

    const release = await response.json();
    const versionName = String(release.tag_name || '').replace(/^v/i, '') || '0.0.0';
    const versionCode = Number(versionName.replace(/\D/g, '') || 0);
    const apk = assetForAbi(release.assets || [], abi);
    if (!apk) {
      return res.json({ success: true, data: { updateAvailable: false, reason: 'no-apk' } });
    }

    const checksumAsset = checksumFor(release.assets || [], apk.name);
    let sha256 = null;
    if (checksumAsset?.browser_download_url) {
      const checksumResponse = await fetch(checksumAsset.browser_download_url, {
        headers: { 'User-Agent': 'Waslha-Updater' }
      });
      if (checksumResponse.ok) {
        const checksumText = await checksumResponse.text();
        sha256 = checksumText.trim().split(/\s+/)[0].toLowerCase() || null;
      }
    }

    const updateAvailable = versionCode > currentCode;

    res.set('Cache-Control', 'public, max-age=300');
    return res.json({
      success: true,
      data: {
        updateAvailable,
        versionName,
        versionCode,
        releaseNotes: release.body || '',
        publishedAt: release.published_at || null,
        mandatory: false,
        apk: {
          name: apk.name,
          size: apk.size,
          url: apk.browser_download_url,
          sha256
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
