import { Router, Request, Response } from 'express';
import Joi from 'joi';
import jwt from 'jsonwebtoken';
import pool from '../Config/connection';

const router = Router();

// JWT Authentication middleware
function authenticateToken(req: Request, res: Response, next: any): void {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({ error: 'Access token required' });
    return;
  }

  jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret', (err: any, user: any) => {
    if (err) {
      res.status(403).json({ error: 'Invalid or expired token' });
      return;
    }
    (req as any).user = user;
    next();
  });
}

// Validation schemas
const personaSchema = Joi.object({
  persona_name: Joi.string().min(1).max(255).optional(),
  description: Joi.string().max(2000).optional(),
  tone: Joi.string().max(50).optional(),
  target_audience: Joi.string().max(1000).optional(),
  key_themes: Joi.array().items(Joi.string()).optional(),
  voice_characteristics: Joi.object().optional(),
});

const questionnaireSchema = Joi.object({
  responses: Joi.array().items(
    Joi.object({
      question_key: Joi.string().required(),
      question_text: Joi.string().required(),
      answer_text: Joi.string().allow('').optional(),
      answer_type: Joi.string().valid('text', 'multiple_choice', 'scale', 'boolean').default('text')
    })
  ).required()
});

// Predefined questionnaire questions
const PERSONA_QUESTIONS = [
  {
    question_key: 'musical_style',
    question_text: 'How would you describe your musical style and genre?',
    answer_type: 'text'
  },
  {
    question_key: 'target_audience',
    question_text: 'Who is your ideal listener or fan?',
    answer_type: 'text'
  },
  {
    question_key: 'inspiration',
    question_text: 'What or who inspires your music and creativity?',
    answer_type: 'text'
  },
  {
    question_key: 'personality_tone',
    question_text: 'How would you describe your personality in social media posts? (casual, professional, edgy, friendly, etc.)',
    answer_type: 'text'
  },
  {
    question_key: 'key_messages',
    question_text: 'What key messages or themes do you want to communicate to your fans?',
    answer_type: 'text'
  },
  {
    question_key: 'posting_frequency',
    question_text: 'How often do you prefer to post on social media?',
    answer_type: 'multiple_choice'
  },
  {
    question_key: 'content_types',
    question_text: 'What types of content do you enjoy creating? (behind-the-scenes, music snippets, personal stories, etc.)',
    answer_type: 'text'
  },
  {
    question_key: 'fan_interaction',
    question_text: 'How do you like to interact with your fans on social media?',
    answer_type: 'text'
  }
];

// Get predefined questionnaire questions
router.get('/questionnaire/questions', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    res.json({
      questions: PERSONA_QUESTIONS,
      total: PERSONA_QUESTIONS.length
    });
    return;
  } catch (error) {
    console.error('Get questionnaire questions error:', error);
    res.status(500).json({ 
      error: 'Internal server error fetching questionnaire questions' 
    });
    return;
  }
});

// Submit questionnaire responses
router.post('/questionnaire', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { error, value } = questionnaireSchema.validate(req.body);
    if (error) {
      res.status(400).json({ 
        error: 'Validation error', 
        details: error.details?.[0]?.message 
      });
      return;
    }

    const userId = (req as any).user.userId;
    const { responses } = value;

    // Get artist ID
    const artistQuery = 'SELECT id FROM artists WHERE user_id = $1';
    const artistResult = await pool.query(artistQuery, [userId]);
    
    if (artistResult.rows.length === 0) {
      res.status(404).json({ 
        error: 'Artist profile not found. Please create an artist profile first.' 
      });
      return;
    }

    const artistId = artistResult.rows[0].id;

    // Create or get existing persona
    const personaQuery = `
      INSERT INTO artist_personas (artist_id, persona_name, description)
      VALUES ($1, $2, $3)
      ON CONFLICT (artist_id) 
      DO UPDATE SET updated_at = CURRENT_TIMESTAMP
      RETURNING id
    `;
    
    const personaResult = await pool.query(personaQuery, [
      artistId, 
      'Main Persona', 
      'Generated from questionnaire responses'
    ]);
    
    const personaId = personaResult.rows[0].id;

    // Save questionnaire responses
    for (const response of responses) {
      const insertResponseQuery = `
        INSERT INTO persona_questionnaires (persona_id, question_key, question_text, answer_text, answer_type)
        VALUES ($1, $2, $3, $4, $5)
      `;
      
      await pool.query(insertResponseQuery, [
        personaId,
        response.question_key,
        response.question_text,
        response.answer_text || '',
        response.answer_type
      ]);
    }

    // Update persona with extracted insights
    await updatePersonaFromResponses(personaId, responses);

    res.json({
      message: 'Questionnaire responses saved successfully',
      persona_id: personaId,
      responses_count: responses.length
    });
    return;

  } catch (error) {
    console.error('Submit questionnaire error:', error);
    res.status(500).json({ 
      error: 'Internal server error saving questionnaire responses' 
    });
    return;
  }
});

// Get persona with questionnaire responses
router.get('/persona', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.userId;

    // Get artist and persona data
    const query = `
      SELECT 
        p.*, 
        a.artist_name,
        COALESCE(
          json_agg(
            json_build_object(
              'question_key', pq.question_key,
              'question_text', pq.question_text,
              'answer_text', pq.answer_text,
              'answer_type', pq.answer_type,
              'created_at', pq.created_at
            )
          ) FILTER (WHERE pq.id IS NOT NULL), 
          '[]'
        ) as questionnaire_responses
      FROM artists a
      LEFT JOIN artist_personas p ON a.id = p.artist_id
      LEFT JOIN persona_questionnaires pq ON p.id = pq.persona_id
      WHERE a.user_id = $1
      GROUP BY p.id, a.artist_name
    `;

    const result = await pool.query(query, [userId]);
    
    if (result.rows.length === 0) {
      res.status(404).json({ 
        message: 'No persona found. Please complete the questionnaire first.' 
      });
      return;
    }

    const personaData = result.rows[0];
    
    res.json({
      persona: {
        id: personaData.id,
        persona_name: personaData.persona_name,
        description: personaData.description,
        tone: personaData.tone,
        target_audience: personaData.target_audience,
        key_themes: personaData.key_themes,
        voice_characteristics: personaData.voice_characteristics,
        created_at: personaData.created_at,
        updated_at: personaData.updated_at,
        is_active: personaData.is_active
      },
      artist_name: personaData.artist_name,
      questionnaire_responses: personaData.questionnaire_responses
    });
    return;

  } catch (error) {
    console.error('Get persona error:', error);
    res.status(500).json({ 
      error: 'Internal server error fetching persona' 
    });
    return;
  }
});

// Update persona details directly
router.put('/:id', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { error, value } = personaSchema.validate(req.body);
    if (error) {
      res.status(400).json({
        error: 'Validation error',
        details: error.details?.[0]?.message
      });
      return;
    }

    const userId = (req as any).user.userId;
    const personaId = req.params.id;

    // Verify the persona belongs to the user
    const ownershipQuery = `
      SELECT p.id
      FROM artist_personas p
      JOIN artists a ON p.artist_id = a.id
      WHERE p.id = $1 AND a.user_id = $2
    `;

    const ownershipResult = await pool.query(ownershipQuery, [personaId, userId]);

    if (ownershipResult.rows.length === 0) {
      res.status(404).json({
        error: 'Persona not found or you do not have permission to update it'
      });
      return;
    }

    // Build dynamic update query based on provided fields
    const updateFields: string[] = [];
    const updateValues: any[] = [];
    let paramCount = 1;

    if (value.persona_name !== undefined) {
      updateFields.push(`persona_name = $${paramCount}`);
      updateValues.push(value.persona_name);
      paramCount++;
    }

    if (value.description !== undefined) {
      updateFields.push(`description = $${paramCount}`);
      updateValues.push(value.description);
      paramCount++;
    }

    if (value.tone !== undefined) {
      updateFields.push(`tone = $${paramCount}`);
      updateValues.push(value.tone);
      paramCount++;
    }

    if (value.target_audience !== undefined) {
      updateFields.push(`target_audience = $${paramCount}`);
      updateValues.push(value.target_audience);
      paramCount++;
    }

    if (value.key_themes !== undefined) {
      updateFields.push(`key_themes = $${paramCount}`);
      updateValues.push(value.key_themes);
      paramCount++;
    }

    if (value.voice_characteristics !== undefined) {
      updateFields.push(`voice_characteristics = $${paramCount}`);
      updateValues.push(JSON.stringify(value.voice_characteristics));
      paramCount++;
    }

    // Always update the timestamp
    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);

    if (updateFields.length === 1) {
      // Only timestamp would be updated, no actual changes
      res.status(400).json({
        error: 'No valid fields provided for update'
      });
      return;
    }

    // Add persona ID as last parameter
    updateValues.push(personaId);

    const updateQuery = `
      UPDATE artist_personas
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING id, persona_name, description, tone, target_audience, key_themes, voice_characteristics, created_at, updated_at, is_active
    `;

    const result = await pool.query(updateQuery, updateValues);

    res.json({
      message: 'Persona updated successfully',
      persona: result.rows[0]
    });
    return;

  } catch (error) {
    console.error('Update persona error:', error);
    res.status(500).json({
      error: 'Internal server error updating persona'
    });
    return;
  }
});

// Helper function to update persona from questionnaire responses
async function updatePersonaFromResponses(personaId: string, responses: any[]): Promise<void> {
  try {
    // Extract key information from responses
    let tone = '';
    let targetAudience = '';
    const keyThemes: string[] = [];
    
    responses.forEach(response => {
      switch (response.question_key) {
        case 'personality_tone':
          tone = response.answer_text;
          break;
        case 'target_audience':
          targetAudience = response.answer_text;
          break;
        case 'key_messages':
          if (response.answer_text) {
            keyThemes.push(...response.answer_text.split(',').map((theme: string) => theme.trim()));
          }
          break;
      }
    });

    // Update persona with extracted data
    const updateQuery = `
      UPDATE artist_personas 
      SET 
        tone = $2,
        target_audience = $3,
        key_themes = $4,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `;
    
    await pool.query(updateQuery, [personaId, tone, targetAudience, keyThemes]);
    return;
    
  } catch (error) {
    console.error('Error updating persona from responses:', error);
    return;
  }
}

export default router;
