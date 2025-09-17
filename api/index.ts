// api/index.ts
import { createNestServer } from '../src/bootstrap';

let cached: any;

export default async function handler(req: any, res: any) {
    if (!cached) {
        cached = await createNestServer();
    }
    return cached(req, res);
}
