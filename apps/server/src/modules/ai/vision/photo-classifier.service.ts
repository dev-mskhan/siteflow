// apps/server/src/modules/ai/vision/photo-classifier.service.ts
import OpenAI from 'openai';
import { z } from 'zod';
import { env } from '@siteflow/env/server';

const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

export const PhotoCategorySchema = z.enum([
  'PROGRESS',
  'DEFICIENCY',
  'SAFETY_ISSUE',
  'MATERIAL_DELIVERY',
  'EQUIPMENT',
  'OTHER',
]);

export type PhotoCategory = z.infer<typeof PhotoCategorySchema>;

export const PhotoAnalysisSchema = z.object({
  category: PhotoCategorySchema,
  description: z.string(),
  suggestedTags: z.array(z.string()).max(10),
  confidence: z.number().min(0).max(1),
  detectedIssues: z
    .array(
      z.object({
        type: z.enum(['SAFETY', 'QUALITY', 'MATERIAL', 'NONE']),
        severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
        description: z.string(),
      })
    )
    .optional(),
});

export type PhotoAnalysis = z.infer<typeof PhotoAnalysisSchema>;

export class PhotoClassifierService {
  async analyzePhoto(imageBase64: string): Promise<PhotoAnalysis> {
    const prompt = `Analyze this construction site photo. Return JSON with:
- category: one of PROGRESS, DEFICIENCY, SAFETY_ISSUE, MATERIAL_DELIVERY, EQUIPMENT, OTHER
- description: detailed description of what's in the photo (50-200 words)
- suggestedTags: array of relevant tags (max 10)
- confidence: your confidence in the classification (0-1)
- detectedIssues: array of issues if any (type: SAFETY|QUALITY|MATERIAL|NONE, severity: LOW|MEDIUM|HIGH|CRITICAL, description)

Return ONLY valid JSON, no markdown formatting.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: { url: `data:image/jpeg;base64,${imageBase64}` },
            },
          ],
        },
      ],
      max_tokens: 800,
      temperature: 0.3,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI Vision API');
    }

    // Parse JSON response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Could not extract JSON from response');
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return PhotoAnalysisSchema.parse(parsed);
  }

  generateFieldLogDraft(analysis: PhotoAnalysis, metadata: {
    location: string;
    timestamp: Date;
    uploadedBy: string;
  }): {
    title: string;
    description: string;
    category: PhotoCategory;
    tags: string[];
    requiresApproval: boolean;
  } {
    return {
      title: `${analysis.category} - ${metadata.location}`,
      description: `${analysis.description}\n\n[Photo taken on ${metadata.timestamp.toISOString()}]\n[Uploaded by ${metadata.uploadedBy}]`,
      category: analysis.category,
      tags: analysis.suggestedTags,
      requiresApproval: true, // NEVER auto-save
    };
  }
}
