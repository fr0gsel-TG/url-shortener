import { RequestHandler } from 'express';
import { getStats, resolveOriginalUrl, shortenUrl } from '../services/urlService';
import { CreateShortUrlInput } from '../utils/validation';

export const shortenController: RequestHandler = async (req, res, next) => {
  try {
    const { originalUrl } = req.body as CreateShortUrlInput;
    const result = await shortenUrl(originalUrl);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
};

export const redirectController: RequestHandler = async (req, res, next) => {
  try {
    const { shortCode } = req.params;
    const originalUrl = await resolveOriginalUrl(shortCode);
    res.redirect(302, originalUrl);
  } catch (err) {
    next(err);
  }
};

export const statsController: RequestHandler = async (req, res, next) => {
  try {
    const { shortCode } = req.params;
    const stats = await getStats(shortCode);
    res.status(200).json(stats);
  } catch (err) {
    next(err);
  }
};
