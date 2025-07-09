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

export const getRaindrops = async (settings: RaindropSyncSettings, collectionId: number): Promise<RaindropItem[]> => {
    if (!settings.apiToken) {
        throw new Error('Raindrop API token is not set.');
    }

    // A collectionId of 0 or -1 typically refers to "Unsorted" bookmarks
    const effectiveCollectionId = collectionId === 0 ? -1 : collectionId;

    const response = await requestUrl({
        url: `${API_BASE_URL}/raindrops/${effectiveCollectionId}`,
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
} 
