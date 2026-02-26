const API_URL = "https://script.google.com/macros/s/AKfycbw6vr_ZXhSuwkKubA7Xq5s9HJsTyEch2MKrqHWFyCEs9HV-N2o88IMoWAdHHO966cGW5Q/exec";

async function testTrackVisit() {
    console.log("Sending POST to GAS...");
    try {
        const res = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'track_visit',
                source: 'node_test',
                medium: 'medium',
                campaign: 'campaign',
                userAgent: 'Node Test',
                referrer: 'test',
                page: '/test'
            })
        });
        const text = await res.text();
        console.log("Response status:", res.status);
        console.log("Response text:", text);
    } catch (e) {
        console.error("Error:", e);
    }
}

testTrackVisit();
