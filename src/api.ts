// Hole alle Highlights global und gib ein Set der Raindrop-IDs zurück, die Highlights haben
export const getAllHighlightRaindropIds = async (settings: RaindropSyncSettings): Promise<Set<number>> => {
    if (!settings.apiToken) {
        throw new Error('Raindrop API token is not set.');
    }
    const url = `${API_BASE_URL}/highlights`;
    const resp = await requestUrl({
        url,
        method: 'GET',
        headers: { 'Authorization': `Bearer ${settings.apiToken}` }
    });
    if (resp.status !== 200) {
        throw new Error(`Failed to fetch highlights: ${resp.status}`);
    }
    const highlightItems = resp.json.items || [];
    const raindropIds = new Set<number>();
    for (const h of highlightItems) {
        if (h.raindropRef) raindropIds.add(h.raindropRef);
    }
    return raindropIds;
};
import { requestUrl } from 'obsidian';
import { RaindropSyncSettings } from './main';

const API_BASE_URL = 'https://api.raindrop.io/rest/v1';

export interface RaindropCollection {
    _id: number;
    title: string;
    parent?: {
        $id: number;
    };
    cover?: string[];
}

export interface RaindropHighlight {
    _id: string;
    text: string;
    note: string;
    created: string;
}

export interface RaindropItem {
    _id: number;
    title: string;
    excerpt: string;
    note: string;
    link: string;
    created: string;
    lastUpdate: string;
    type: string;
    domain: string;
    collection: {
        $id: number;
    };
    tags: string[];
    highlights: RaindropHighlight[];
}

export const getCollections = async (settings: RaindropSyncSettings): Promise<RaindropCollection[]> => {
    if (!settings.apiToken) {
        throw new Error('Raindrop API token is not set.');
    }

    const [rootResponse, childrenResponse] = await Promise.all([
        requestUrl({
            url: `${API_BASE_URL}/collections`,
            method: 'GET',
            headers: { 'Authorization': `Bearer ${settings.apiToken}` }
        }),
        requestUrl({
            url: `${API_BASE_URL}/collections/childrens`,
            method: 'GET',
            headers: { 'Authorization': `Bearer ${settings.apiToken}` }
        })
    ]);

    if (rootResponse.status !== 200 || childrenResponse.status !== 200) {
        throw new Error(`Failed to fetch collections: Root Status ${rootResponse.status}, Children Status ${childrenResponse.status}`);
    }
    
    const rootItems = rootResponse.json.items || [];
    const childrenItems = childrenResponse.json.items || [];

    const allItems = [...rootItems, ...childrenItems];
    const collectionMap = new Map<number, RaindropCollection>();
    allItems.forEach(item => {
        collectionMap.set(item._id, item);
    });

    return Array.from(collectionMap.values());
};


export const getRaindrops = async (settings: RaindropSyncSettings, collectionId: number, since?: string): Promise<RaindropItem[]> => {
    if (!settings.apiToken) {
        throw new Error('Raindrop API token is not set.');
    }

    // A collectionId of 0 or -1 typically refers to "Unsorted" bookmarks
    const effectiveCollectionId = collectionId === 0 ? -1 : collectionId;

    // Wenn nur Bookmarks mit Highlights gewünscht sind, nutze den Highlights-Endpoint
    if (settings.onlyBookmarksWithHighlights) {
        // 1. Alle Highlights für die Collection holen
        const highlightsUrl = `${API_BASE_URL}/highlights/${effectiveCollectionId}`;
		console.log('Fetching highlights from:', highlightsUrl);

        const highlightsResp = await requestUrl({
            url: highlightsUrl,
            method: 'GET',
            headers: { 'Authorization': `Bearer ${settings.apiToken}` }
        });
        if (highlightsResp.status !== 200) {
            throw new Error(`Failed to fetch highlights: ${highlightsResp.status}`);
        }
        const highlightItems = highlightsResp.json.items || [];
		console.log(`Found ${highlightItems.length} highlights for collection ${effectiveCollectionId}`);

        // 2. Eindeutige Raindrop-IDs extrahieren
        const raindropIds = Array.from(new Set(highlightItems.map((h: any) => h.raindropRef).filter(Boolean)));
        if (raindropIds.length === 0) return [];

        // 3. Bookmarks einzeln abrufen (API hat keinen Batch-GET)
        const bookmarks: RaindropItem[] = [];
        for (const id of raindropIds) {
            try {
                const resp = await requestUrl({
                    url: `${API_BASE_URL}/raindrop/${id}`,
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${settings.apiToken}` }
                });
                if (resp.status === 200 && resp.json && resp.json.item) {
                    // since-Filter ggf. anwenden
                    if (since) {
                        const lastUpdate = resp.json.item.lastUpdate || resp.json.item.created;
                        if (lastUpdate && lastUpdate < since) continue;
                    }
                    bookmarks.push(resp.json.item);
                }
            } catch (e) {
                // Einzelne Fehler ignorieren, Rest weiterverarbeiten
                continue;
            }
        }
        return bookmarks;
    }

    // Standard: alle Bookmarks der Collection holen
    let url = `${API_BASE_URL}/raindrops/${effectiveCollectionId}`;
    const params = new URLSearchParams();

    if (since) {
        params.append('search', `lastUpdate:>${since.slice(0, 10)}`);
    }

    const paramString = params.toString();
    if (paramString) {
        url += `?${paramString}`;
    }

    const response = await requestUrl({
        url,
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${settings.apiToken}`
        }
    });

    if (response.status === 200) {
        const data = response.json;
        if (data.items) {
            return data.items;
        }
    }

    throw new Error(`Failed to fetch raindrops: ${response.status}`);
};
