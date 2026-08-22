import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { createUploader, publicUploadUrl } from '../lib/uploads';

const router = Router();
const upload = createUploader();

router.post('/', authenticate, (req: AuthRequest, res: Response) => {
  if (!req.user?.clientId && req.user?.role !== 'SUPER_ADMIN') {
    return res.status(400).json({ error: 'No hay negocio asociado para guardar la imagen' });
  }

  upload.single('file')(req, res, (err) => {
    if (err) {
      const message = err instanceof Error ? err.message : 'No se pudo subir la imagen';
      const status = message.includes('File too large') ? 413 : 400;
      return res.status(status).json({
        error: message.includes('File too large')
          ? 'La imagen supera 5 MB'
          : message,
      });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Selecciona una imagen' });
    }

    res.status(201).json({ url: publicUploadUrl(req.file) });
  });
});

export default router;
