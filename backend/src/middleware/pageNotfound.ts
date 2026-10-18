import { Request, Response } from "express"

export const pageNotFound = (req: Request, res: Response) => {
    return res.status(404).json({ error: "Page Not Found" })
}