import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 120 // Longer timeout for document processing

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get('x-api-key')
  
  if (!apiKey) {
    return NextResponse.json({ error: 'API key is required' }, { status: 401 })
  }

  // Check if file is uploaded as form data
  const formData = await req.formData()
  const file = formData.get('file') as File | null
  
  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  // Validate file type
  const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'application/pdf']
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json({ 
      error: `Invalid file type. Allowed: PNG, JPG, PDF. Got: ${file.type}` 
    }, { status: 400 })
  }

  // Get language parameter (default to English)
  const language = formData.get('language') as string || 'en-IN'
  
  console.log(`[Vision] Processing file: ${file.name}, type: ${file.type}, size: ${file.size}, language: ${language}`)

  try {
    // Step 1: Create a document intelligence job
    const createJobResponse = await fetch('https://api.sarvam.ai/v1/document-intelligence/jobs', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'api-subscription-key': apiKey,
      },
      body: JSON.stringify({
        language: language,
        output_format: 'md',
      }),
    })

    if (!createJobResponse.ok) {
      const errorText = await createJobResponse.text()
      console.log(`[Vision] Create job error: ${createJobResponse.status} - ${errorText}`)
      return NextResponse.json({ error: `Failed to create job: ${errorText}` }, { status: createJobResponse.status })
    }

    const jobData = await createJobResponse.json()
    const jobId = jobData.job_id
    console.log(`[Vision] Job created: ${jobId}`)

    // Step 2: Get upload URL
    const uploadUrlResponse = await fetch(`https://api.sarvam.ai/v1/document-intelligence/jobs/${jobId}/upload-url`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'api-subscription-key': apiKey,
      },
    })

    if (!uploadUrlResponse.ok) {
      const errorText = await uploadUrlResponse.text()
      console.log(`[Vision] Get upload URL error: ${uploadUrlResponse.status} - ${errorText}`)
      return NextResponse.json({ error: `Failed to get upload URL: ${errorText}` }, { status: uploadUrlResponse.status })
    }

    const uploadData = await uploadUrlResponse.json()
    console.log(`[Vision] Got upload URL`)

    // Step 3: Upload the file
    const fileBuffer = await file.arrayBuffer()
    const uploadResponse = await fetch(uploadData.upload_url, {
      method: 'PUT',
      headers: {
        'Content-Type': file.type,
      },
      body: fileBuffer,
    })

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text()
      console.log(`[Vision] Upload error: ${uploadResponse.status} - ${errorText}`)
      return NextResponse.json({ error: `Failed to upload file: ${errorText}` }, { status: uploadResponse.status })
    }

    console.log(`[Vision] File uploaded successfully`)

    // Step 4: Start the processing job
    const startResponse = await fetch(`https://api.sarvam.ai/v1/document-intelligence/jobs/${jobId}/start`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'api-subscription-key': apiKey,
      },
    })

    if (!startResponse.ok) {
      const errorText = await startResponse.text()
      console.log(`[Vision] Start job error: ${startResponse.status} - ${errorText}`)
      return NextResponse.json({ error: `Failed to start job: ${errorText}` }, { status: startResponse.status })
    }

    console.log(`[Vision] Job started, polling for completion...`)

    // Step 5: Poll for job completion
    let jobStatus = 'IN_PROGRESS'
    let maxAttempts = 60 // Max 60 * 2s = 120 seconds
    let attempts = 0

    while (jobStatus === 'IN_PROGRESS' || jobStatus === 'QUEUED') {
      if (attempts >= maxAttempts) {
        return NextResponse.json({ error: 'Job timed out after 2 minutes' }, { status: 504 })
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      const statusResponse = await fetch(`https://api.sarvam.ai/v1/document-intelligence/jobs/${jobId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'api-subscription-key': apiKey,
        },
      })

      if (!statusResponse.ok) {
        const errorText = await statusResponse.text()
        console.log(`[Vision] Status check error: ${statusResponse.status} - ${errorText}`)
        return NextResponse.json({ error: `Failed to get job status: ${errorText}` }, { status: statusResponse.status })
      }

      const statusData = await statusResponse.json()
      jobStatus = statusData.job_state
      console.log(`[Vision] Job status: ${jobStatus}`)
      attempts++
    }

    if (jobStatus === 'FAILED') {
      return NextResponse.json({ error: 'Document processing failed' }, { status: 500 })
    }

    if (jobStatus !== 'COMPLETED') {
      return NextResponse.json({ error: `Unexpected job state: ${jobStatus}` }, { status: 500 })
    }

    // Step 6: Get download URL
    const downloadUrlResponse = await fetch(`https://api.sarvam.ai/v1/document-intelligence/jobs/${jobId}/download-urls`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'api-subscription-key': apiKey,
      },
    })

    if (!downloadUrlResponse.ok) {
      const errorText = await downloadUrlResponse.text()
      console.log(`[Vision] Get download URL error: ${downloadUrlResponse.status} - ${errorText}`)
      return NextResponse.json({ error: `Failed to get download URL: ${errorText}` }, { status: downloadUrlResponse.status })
    }

    const downloadData = await downloadUrlResponse.json()
    const resultUrl = downloadData.result_urls[0]

    // Step 7: Fetch the result content
    const resultResponse = await fetch(resultUrl)
    if (!resultResponse.ok) {
      const errorText = await resultResponse.text()
      return NextResponse.json({ error: `Failed to download result: ${errorText}` }, { status: resultResponse.status })
    }

    // The result is a ZIP file containing the processed document
    // For simplicity, we'll return the content directly if it's text
    const contentType = resultResponse.headers.get('content-type')
    
    if (contentType?.includes('application/zip')) {
      // Convert to base64 for client-side handling
      const arrayBuffer = await resultResponse.arrayBuffer()
      const base64 = Buffer.from(arrayBuffer).toString('base64')
      
      return NextResponse.json({
        success: true,
        jobId,
        resultType: 'zip',
        base64,
        message: 'Document processed successfully. Download the ZIP file to extract the content.',
      })
    } else {
      // Return text content directly
      const textContent = await resultResponse.text()
      
      return NextResponse.json({
        success: true,
        jobId,
        resultType: 'text',
        content: textContent,
      })
    }

  } catch (err: any) {
    console.log(`[Vision] Error: ${err.message}`)
    return NextResponse.json({ error: `Error: ${err.message}` }, { status: 500 })
  }
}
