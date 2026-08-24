import { Router, Request, Response } from 'express';
import { generatePreVisitSummary, generatePostVisitSummary } from '../services/geminiService';

const router = Router();

// Test AI Pre-visit summary generation
router.post('/pre-visit-summary', async (req: Request, res: Response) => {
  try {
    const { symptoms } = req.body;
    if (!symptoms) {
      return res.status(400).json({ error: 'symptoms field is required' });
    }

    const summary = await generatePreVisitSummary(symptoms);
    return res.json({ summary });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'AI summary generation failed' });
  }
});

// Test AI Post-visit summary generation
router.post('/post-visit-summary', async (req: Request, res: Response) => {
  try {
    const { notes } = req.body;
    if (!notes) {
      return res.status(400).json({ error: 'notes field is required' });
    }

    const summary = await generatePostVisitSummary(notes);
    return res.json({ summary });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'AI post-visit summary generation failed' });
  }
});

export default router;
