import {Request, Response, Router} from 'express';
import {WebApiSetup} from '@event-driven-io/emmett-expressjs';
import {getKnexInstance} from '../../common/db';
import {requireUser} from '../../supabase/requireUser';
import {assertNotEmpty} from '../../util/assertions';

export const api = (): WebApiSetup => (router: Router): void => {

    /**
     * @openapi
     * /api/org/{orgId}/examples:
     *   get:
     *     summary: List all examples for an organization
     *     tags: [Example]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: orgId
     *         required: true
     *         schema: { type: string }
     *     responses:
     *       200:
     *         description: List of examples
     *       401:
     *         description: Unauthorized
     */
    router.get('/api/org/:orgId/examples', async (req: Request, res: Response) => {
        const auth = await requireUser(req, res);
        if (auth.error) return;

        const {orgId} = req.params;
        const db = getKnexInstance();

        const rows = await db('examples').where({organization_id: orgId}).select('*');
        res.status(200).json(rows);
    });

    /**
     * @openapi
     * /api/org/{orgId}/examples:
     *   post:
     *     summary: Create a new example
     *     tags: [Example]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: orgId
     *         required: true
     *         schema: { type: string }
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required: [name]
     *             properties:
     *               name:
     *                 type: string
     *     responses:
     *       201:
     *         description: Example created
     *       400:
     *         description: name is required
     *       401:
     *         description: Unauthorized
     */
    router.post('/api/org/:orgId/examples', async (req: Request, res: Response) => {
        const auth = await requireUser(req, res);
        if (auth.error) return;

        const {orgId} = req.params;
        const {name} = req.body as {name?: string};

        if (!name) {
            res.status(400).json({error: 'name is required'});
            return;
        }

        const db = getKnexInstance();
        const [row] = await db('examples')
            .insert({organization_id: orgId, name, created_by: auth.user.id})
            .returning('*');

        res.status(201).json(row);
    });

    /**
     * @openapi
     * /api/org/{orgId}/examples/{id}:
     *   delete:
     *     summary: Delete an example by id
     *     tags: [Example]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: orgId
     *         required: true
     *         schema: { type: string }
     *       - in: path
     *         name: id
     *         required: true
     *         schema: { type: string }
     *     responses:
     *       200:
     *         description: Example deleted
     *       401:
     *         description: Unauthorized
     *       404:
     *         description: Not found
     */
    router.delete('/api/org/:orgId/examples/:id', async (req: Request, res: Response) => {
        const auth = await requireUser(req, res);
        if (auth.error) return;

        const orgId = assertNotEmpty(req.params.orgId);
        const id = assertNotEmpty(req.params.id);

        const db = getKnexInstance();
        const deleted = await db('examples')
            .where({id, organization_id: orgId})
            .delete();

        if (!deleted) {
            res.status(404).json({error: 'not found'});
            return;
        }

        res.status(200).json({ok: true});
    });
};