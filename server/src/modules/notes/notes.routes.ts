import { Router } from 'express';
import { withUserContext } from '../../config/db.js';
import { authenticate } from '../../middleware/auth.js';
import { notePatchSchema, noteSchema } from '../../lib/schemas.js';
import { AppError } from '../../lib/types.js';
import { diagramsService } from '../diagrams/diagrams.service.js';
import type { NoteDto } from '../../lib/mappers.js';

export const notesRouter = Router();
notesRouter.use(authenticate);

notesRouter.get('/diagrams/:diagramId/notes', async (req, res, next) => {
    try {
        const data = await withUserContext(req.user!.id, (client) =>
            diagramsService.listNotes(client, req.params.diagramId)
        );
        res.json(data);
    } catch (err) {
        next(err);
    }
});

notesRouter.get('/diagrams/:diagramId/notes/:id', async (req, res, next) => {
    try {
        const data = await withUserContext(req.user!.id, (client) =>
            diagramsService.getNote(client, req.params.diagramId, req.params.id)
        );
        if (!data) throw new AppError(404, 'Note not found', 'not_found');
        res.json(data);
    } catch (err) {
        next(err);
    }
});

notesRouter.post('/diagrams/:diagramId/notes', async (req, res, next) => {
    try {
        const body = noteSchema.parse(req.body);
        await withUserContext(req.user!.id, (client) =>
            diagramsService.upsertNote(
                client,
                req.params.diagramId,
                body as NoteDto,
                req.user!.id
            )
        );
        res.status(201).json({ ok: true });
    } catch (err) {
        next(err);
    }
});

notesRouter.patch('/notes/:id', async (req, res, next) => {
    try {
        const body = notePatchSchema.parse(req.body);
        await withUserContext(req.user!.id, (client) =>
            diagramsService.updateNote(client, req.params.id, body)
        );
        res.json({ ok: true });
    } catch (err) {
        next(err);
    }
});

notesRouter.delete('/diagrams/:diagramId/notes/:id', async (req, res, next) => {
    try {
        await withUserContext(req.user!.id, (client) =>
            diagramsService.deleteNote(
                client,
                req.params.diagramId,
                req.params.id
            )
        );
        res.status(204).send();
    } catch (err) {
        next(err);
    }
});

notesRouter.delete('/diagrams/:diagramId/notes', async (req, res, next) => {
    try {
        await withUserContext(req.user!.id, (client) =>
            diagramsService.deleteDiagramNotes(client, req.params.diagramId)
        );
        res.status(204).send();
    } catch (err) {
        next(err);
    }
});
