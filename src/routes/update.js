import { Router } from 'express';

const router = Router();
const RELEASE_REPO = process.env.UPDATE_GITHUB_REPO || 'FMG18/waslha-frontend';
const GITHUB_API = `https://api.github.com/repos/${RELEASE_REPO}/releases/latest`;

router.get('/', async (req, res, next) => {
  try {
    const currentCode = Number(req.query.currentCode || 0);
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
    const apk = (release.assets || []).find((asset) => asset.name === 'waslha.apk')
      || (release.assets || []).find((asset) => asset.name.endsWith('.apk'));

    if (!apk) {
      return res.json({ success: true, data: { updateAvailable: false, reason: 'no-apk' } });
    }

    const checksumAsset = (release.assets || []).find((asset) => asset.name === `${apk.name}.sha256`);
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

    res.set('Cache-Control', 'public, max-age=300');
    return res.json({
      success: true,
      data: {
        updateAvailable: versionCode > currentCode,
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
